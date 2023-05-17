import React, { useEffect, useState } from "react";
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";

import "./App.css";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, firestore } from "./firebase";

interface IAccount {
  id: string;
  username: string;
}

interface IFriendRequest {
  id: string;
  friendRequestId: string;
  username: string;
}

interface IFriend {
  id: string;
  friendRequestId: string;
  friendId: string;
  username: string;
}

const signup = async (email: string, password: string, displayName: string) => {
  try {
    const userCreds = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    await updateProfile(userCreds.user, { displayName });
    const docData = { id: userCreds.user.uid, username: displayName };
    await setDoc(doc(firestore, "users", userCreds.user.uid), docData);
    return docData as IAccount;
  } catch (error: any) {
    console.log(error);
    console.log(error.message);
    return { id: "", username: "" } as IAccount;
  }
};

const signin = async (email: string, password: string) => {
  try {
    const userCreds = await signInWithEmailAndPassword(auth, email, password);
    const collectionRef = collection(firestore, "users");
    const searchQuery = query(
      collectionRef,
      where("username", "==", userCreds.user.displayName)
    );
    const querySnapshot = await getDocs(searchQuery);
    const myAcc = querySnapshot.docs.map((acc) => {
      return acc.data() as IAccount;
    });
    return myAcc[0];
  } catch (error: any) {
    console.log(error);
    console.log(error.message);
    return { id: "", username: "" } as IAccount;
  }
};

const signout = async () => {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.log(error);
    console.log(error.message);
  }
};

const searchUsers = async (username: string) => {
  try {
    const collectionRef = collection(firestore, "users");
    const searchQuery = query(collectionRef, where("username", "==", username));
    const querySnapshot = await getDocs(searchQuery);
    const searchedUsers = querySnapshot.docs.map((user) => {
      const userData = user.data();
      return { ...userData, id: user.id } as IAccount;
    });
    return searchedUsers;
  } catch (error: any) {
    console.log(error);
    console.log(error.message);
    return [];
  }
};

const sendFR = async (user: User, myAccount: IAccount, account: IAccount) => {
  try {
    const accountDocRef = doc(firestore, "friendRequests", account.id);
    const requestCollectionRef = collection(accountDocRef, "requests");

    const data = await addDoc(requestCollectionRef, myAccount);
    return data.id;
  } catch (error: any) {
    console.log(error);
    console.log(error.message);
    return "";
  }
};

const getMySentFRs = async (user: User) => {
  // try {
  //   const accountDocRef = collection(firestore, "friendRequests");
  //   // const requestCollectionRef = collection(accountDocRef, "requests");

  //   // const searchQuery = query(
  //   //   requestCollectionRef,
  //   //   where("uid", "==", user.uid)
  //   // );

  //   const dataSnapshot = await getDocs(accountDocRef);

  //   console.log(dataSnapshot);

  //   // const myFRs = dataSnapshot.docs.map((request) => {
  //   //   const req = request.data();
  //   //   return { ...req, friendRequestId: request.id } as IFriendRequest;
  //   // });

  //   // return myFRs;
  //   return [];
  // } catch (error: any) {
  //   console.log(error);
  //   console.log(error.message);
  //   return [];
  // }
  return [];
};

const getMyReceivedFRs = async (user: User) => {
  try {
    const accountDocRef = doc(firestore, "friendRequests", user.uid);
    const requestCollectionRef = collection(accountDocRef, "requests");

    const dataSnapshot = await getDocs(requestCollectionRef);

    const myReceivedFRs = dataSnapshot.docs.map((request) => {
      const req = request.data();
      return { ...req, friendRequestId: request.id } as IFriendRequest;
    });

    return myReceivedFRs;
  } catch (error: any) {
    console.log(error);
    console.log(error.message);
    return [];
  }
};

const acceptFR = async (
  user: User,
  myAccount: IAccount,
  request: IFriendRequest
) => {
  try {
    const batch = writeBatch(firestore);

    //adding in my friends
    const friendsDocRef = doc(firestore, "myFriends", user.uid);
    const friendsCollectionRef = collection(friendsDocRef, "friends");

    const data = await addDoc(friendsCollectionRef, request);

    //adding in opponents friends
    const oppFriendsDocRef = doc(firestore, "myFriends", request.id);
    const oppFriendsCollectionRef = collection(oppFriendsDocRef, "friends");

    // const oppData = await addDoc(oppFriendsCollectionRef, {
    //   ...myAccount,
    //   friendRequestId: request.friendRequestId,
    // });

    await addDoc(oppFriendsCollectionRef, {
      ...myAccount,
      friendRequestId: request.friendRequestId,
    });

    //removing from my friends request
    const friendsRequestDocRef = doc(
      firestore,
      "friendRequests",
      user.uid,
      "requests",
      request.friendRequestId
    );
    await deleteDoc(friendsRequestDocRef);

    //removing from opponents friends requests
    const oppFriendsRequestDocRef = doc(
      firestore,
      "friendRequests",
      request.id
    );
    const oppFriendsRequestCollectionRef = collection(
      oppFriendsRequestDocRef,
      "requests"
    );

    const deleteQuery = query(
      oppFriendsRequestCollectionRef,
      where("id", "==", myAccount.id)
    );
    const querySnapshot = await getDocs(deleteQuery);

    for (const docSnap of querySnapshot.docs) {
      const docRef = doc(
        firestore,
        "friendRequests",
        request.id,
        "requests",
        docSnap.id
      );
      await deleteDoc(docRef);
    }

    await batch.commit();

    return data.id;
  } catch (error: any) {
    console.log(error);
    console.log(error.message);
    return "";
  }
};

const getMyFriends = async (user: User) => {
  try {
    const friendsDocRef = doc(firestore, "myFriends", user.uid);
    const friendsCollectionRef = collection(friendsDocRef, "friends");
    const dataSnapshot = await getDocs(friendsCollectionRef);

    const myFriends = dataSnapshot.docs.map((friend) => {
      const frnd = friend.data();
      return { ...frnd, friendId: friend.id } as IFriend;
    });

    return myFriends;
  } catch (error: any) {
    console.log(error);
    console.log(error.message);
    return [];
  }
};

const rejectFriendRequest = async (
  user: User,
  myAccount: IAccount,
  request: IFriendRequest
) => {
  try {
    const friendsRequestDocRef = doc(
      firestore,
      "friendRequests",
      user.uid,
      "requests",
      request.friendRequestId
    );
    await deleteDoc(friendsRequestDocRef);
    return "success";
  } catch (error: any) {
    console.log(error);
    console.log(error.message);
    return "error";
  }
};

const removeFriend = async (
  user: User,
  myAccount: IAccount,
  friend: IFriend
) => {
  try {
    const batch = writeBatch(firestore);

    //removing friend from my account
    const friendDocRef = doc(
      firestore,
      "myFriends",
      user.uid,
      "friends",
      friend.friendId
    );

    await deleteDoc(friendDocRef);

    //removing from opponent account

    const oppFriendDocRef = doc(firestore, "myFriends", friend.id);
    const oppFriendCollectionRef = collection(oppFriendDocRef, "friends");

    const deleteQuery = query(
      oppFriendCollectionRef,
      where("id", "==", myAccount.id)
    );

    const querySnapshot = await getDocs(deleteQuery);

    for (const docSnap of querySnapshot.docs) {
      const docRef = doc(
        firestore,
        "myFriends",
        friend.id,
        "friends",
        docSnap.id
      );

      await deleteDoc(docRef);
    }

    await batch.commit();

    return "success";
  } catch (error: any) {
    console.log(error);
    console.log(error.message);
    return "error";
  }
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [myAccount, setMyAccount] = useState<IAccount | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [searchUsernameTerm, setSearchUsernameterm] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<IAccount[]>([]);
  const [mySentFR, setMySentFR] = useState<IFriendRequest[]>([]);
  const [myReceivedFR, setMyReceivedFR] = useState<IFriendRequest[]>([]);
  const [myFriends, setMyFriends] = useState<IFriend[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        setMyAccount({ id: user.uid, username: user.displayName as string });
      } else {
        setUser(null);
        setMyAccount(null);
      }
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const results = await searchUsers(searchUsernameTerm);
      setSearchedUsers(
        results.filter(
          (acc) =>
            acc.id !== user?.uid &&
            mySentFR.findIndex((req) => req.id === acc.id) === -1 &&
            myReceivedFR.findIndex((req) => req.id === acc.id) === -1 &&
            myFriends.findIndex((friend) => friend.id === acc.id) === -1
        )
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [myFriends, myReceivedFR, mySentFR, searchUsernameTerm, user?.uid]);

  const getMySentRequests = async (user: User) => {
    const mySentFRs = await getMySentFRs(user);
    setMySentFR(mySentFRs);
  };

  const getMyReceivedRequests = async (user: User) => {
    const myReceivedFRs = await getMyReceivedFRs(user);
    setMyReceivedFR(myReceivedFRs);
  };

  const getMyFrnds = async (user: User) => {
    const myFriends = await getMyFriends(user);
    setMyFriends(myFriends);
  };

  useEffect(() => {
    if (user) {
      getMySentRequests(user);
      getMyReceivedRequests(user);
      getMyFrnds(user);
      document.title = user.displayName ?? "My Networks";

      const unsubscribeFriendRequest = onSnapshot(
        collection(firestore, "friendRequests", user.uid, "requests"),
        (myReceivedFRsSnapshot) => {
          const myReceivedFRs = myReceivedFRsSnapshot.docs.map((req) => {
            const request = req.data();
            return { ...request, friendRequestId: req.id } as IFriendRequest;
          });
          setMyReceivedFR(myReceivedFRs);
        }
      );

      const unsubscribeMyFriends = onSnapshot(
        collection(firestore, "myFriends", user.uid, "friends"),
        (myFriendsSnapshot) => {
          const myReceivedFRs = myFriendsSnapshot.docs.map((frnd) => {
            const friend = frnd.data();
            return { ...friend, friendId: frnd.id } as IFriend;
          });
          setMyFriends(myReceivedFRs);
        }
      );

      return () => {
        unsubscribeFriendRequest();
        unsubscribeMyFriends();
      };
    }
  }, [user]);

  return (
    <div className="App">
      <div className="user">
        <span>Authentication : </span>
        <span style={{ color: user ? "green" : "red" }}>
          {user ? "Authenticated" : "Not Authenticated"}
        </span>
        <div className="input">
          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!user}
          />
        </div>
        <div className="input">
          <label>Username</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={!!user}
          />
        </div>
        <div className="input">
          <label>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!!user}
          />
        </div>
        <div>
          <button onClick={() => signin(email, password)} disabled={!!user}>
            Login
          </button>
          <button
            onClick={async () => {
              const myAccount = await signup(email, password, displayName);
              setMyAccount(myAccount);
            }}
            disabled={!!user}
          >
            Signup
          </button>
          <button onClick={() => signout()}>Logout</button>
        </div>
      </div>
      <div className="search-friends">
        <div>Friends</div>
        <div>
          <input
            placeholder="Search by username"
            value={searchUsernameTerm}
            onChange={(e) => setSearchUsernameterm(e.target.value)}
          />{" "}
          <button onClick={() => searchUsers(searchUsernameTerm)}>
            Search
          </button>
        </div>
      </div>
      <div className="search-results">
        <div>Search Results</div>
        {searchedUsers.length === 0 && <div>No Users Available.</div>}
        {searchedUsers.length > 0 &&
          searchedUsers.map((account, index) => (
            <div key={account.id}>
              <span>{index + 1}. </span>
              <span>{account.username}</span>{" "}
              <button
                onClick={async () => {
                  const docId = await sendFR(
                    user as User,
                    myAccount as IAccount,
                    account
                  );
                  if (docId) {
                    setMySentFR((prevFRs) => [
                      ...prevFRs,
                      {
                        id: account.id,
                        friendRequestId: docId,
                        username: account.username,
                      },
                    ]);
                  }
                }}
              >
                Send Request
              </button>
            </div>
          ))}
      </div>
      <div className="my-sent-friend-requests">
        <div>My Sent Requests</div>
        {mySentFR.length === 0 && <span>No Requests.</span>}
        {mySentFR.length > 0 &&
          mySentFR.map((request, index) => (
            <div key={request.friendRequestId}>
              <span>{index + 1}. </span>
              <span>{request.username}</span>
            </div>
          ))}
      </div>
      <div className="my-received-friend-requests">
        <div>My Received Requests</div>
        {myReceivedFR.length === 0 && <span>No Requests.</span>}
        {myReceivedFR.length > 0 &&
          myReceivedFR.map((request, index) => (
            <div key={request.friendRequestId}>
              <span>{index + 1}. </span>
              <span>{request.username}</span>{" "}
              {isLoading ? (
                <span>Accepting Request...</span>
              ) : (
                <>
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      const friendId = await acceptFR(
                        user as User,
                        myAccount as IAccount,
                        request
                      );
                      if (friendId) {
                        setMyReceivedFR((prevRequests) =>
                          prevRequests.filter(
                            (req) =>
                              req.friendRequestId !== request.friendRequestId
                          )
                        );
                        // setMyFriends((prevFriends) => [
                        //   ...prevFriends,
                        //   {
                        //     id: request.id,
                        //     friendRequestId: request.friendRequestId,
                        //     friendId: friendId,
                        //     username: request.username,
                        //   },
                        // ]);
                      }
                      setIsLoading(false);
                    }}
                  >
                    Accept Request
                  </button>{" "}
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      const response = await rejectFriendRequest(
                        user as User,
                        myAccount as IAccount,
                        request
                      );
                      if (response === "success") {
                        setMyReceivedFR((prevRequests) =>
                          prevRequests.filter(
                            (req) =>
                              req.friendRequestId !== request.friendRequestId
                          )
                        );
                      }
                      setIsLoading(false);
                    }}
                  >
                    Reject Request
                  </button>
                </>
              )}
            </div>
          ))}
      </div>
      <div className="my-friends">
        <div>My Friends</div>
        {myFriends.length === 0 && <span>No Friends.</span>}
        {myFriends.length > 0 &&
          myFriends.map((friend, index) => (
            <div key={friend.friendId}>
              <span>{index + 1}. </span>
              <span>{friend.username}</span>{" "}
              <button
                onClick={async () => {
                  const response = await removeFriend(
                    user as User,
                    myAccount as IAccount,
                    friend
                  );
                  if (response === "success") {
                    setMyFriends((myFriends) =>
                      myFriends.filter(
                        (frnd) => frnd.friendId !== friend.friendId
                      )
                    );
                  }
                }}
              >
                Remove Friend
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

export default App;
