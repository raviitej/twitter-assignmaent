const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeServerAndDbConnection = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {});
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};
initializeServerAndDbConnection();

//API 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const checkQuery = `SELECT * FROM user WHERE username='${username}';`;
  const checkQueryResult = await db.get(checkQuery);
  if (checkQueryResult === undefined) {
    const dbQuery = `INSERT INTO user(name,username,password,gender)VALUES('${username}','${name}','${hashedPassword}','${gender}');`;

    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      await db.run(dbQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userNameQuery = `SELECT * FROM user WHERE username='${username}';`;
  const getResult = await db.get(userNameQuery);

  if (getResult !== undefined) {
    const checkPassword = await bcrypt.compare(password, getResult.password);
    if (checkPassword === true) {
      response.status(200);
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "my_secret_token");
      response.send({ jwtToken: jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

const authenticateToken = (request, response, next) => {
  let jwToken;
  const authorizationHeader = request.headers["authorization"];
  if (authorizationHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwToken = authorizationHeader.split(" ")[1];
    jwt.verify(jwToken, "my_secret_token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const username = request.username;
  const userQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const result = await db.get(userQuery);
  const followersQuery = `SELECT username, tweet,date_time AS dateTime FROM (follower  INNER JOIN tweet ON follower.following_user_id=tweet.user_id) AS T NATURAL JOIN user WHERE follower_user_id=${result.user_id} ORDER BY date_time DESC LIMIT 4`;
  const followerResult = await db.all(followersQuery);
  response.status(200);
  response.send(followerResult);
});

//API4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const username = request.username;
  const userQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const result = await db.get(userQuery);
  const followersQuery = `SELECT DISTINCT name FROM (follower  INNER JOIN tweet ON follower.following_user_id=tweet.user_id) AS T NATURAL JOIN user WHERE follower_user_id=${result.user_id} `;
  const followerResult = await db.all(followersQuery);
  response.status(200);
  response.send(followerResult);
});

//API5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const username = request.username;
  const userQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const result = await db.get(userQuery);
  const followersQuery = `SELECT DISTINCT name FROM follower  INNER JOIN user ON follower.following_user_id=${result.user_id} WHERE follower_user_id=user_id `;
  const followerResult = await db.all(followersQuery);
  response.status(200);
  response.send(followerResult);
});

//API6
const getResult = (object, userId) => {
  let result;
  for (let each of object) {
    if (each.following_user_id === userId) {
      result = true;
      return result;
    } else {
      result = false;
    }
  }
  return result;
};

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const username = request.username;
  const userQ = `SELECT user_id FROM user WHERE username='${username}';`;
  const result = await db.get(userQ);
  const userTweet = `SELECT user.user_id FROM user INNER JOIN tweet ON user.user_id=tweet.user_id WHERE tweet.tweet_id=${tweetId};`;
  const tweetUserId = await db.get(userTweet);
  const userQuery = `SELECT follower.following_user_id FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id WHERE user_id=${result.user_id} ;`;
  const followingData = await db.all(userQuery);
  if (getResult(followingData, tweetUserId.user_id) === true) {
    const tweetQuery = `SELECT tweet,COUNT(  DISTINCT  like.like_id) AS likes,COUNT( DISTINCT T.reply_id)AS replies, tweet.date_time AS dateTime FROM (tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id ) AS T INNER JOIN like ON T.tweet_id=like.tweet_id WHERE  T.tweet_id=${tweetId}   ;`;
    const outputTweet = await db.get(tweetQuery);
    response.status(200);
    response.send(outputTweet);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API 7

const output = (objectData) => {
  let propertyValues;
  let new_list = [];
  for (let each of objectData) {
    propertyValues = Object.values(each);
    new_list.push(propertyValues[0]);
  }
  return { likes: new_list };
};

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const username = request.username;
    const userQ8 = `SELECT user_id FROM user WHERE username='${username}';`;
    const result8 = await db.get(userQ8);
    const userTweet8 = `SELECT user.user_id FROM user INNER JOIN tweet ON user.user_id=tweet.user_id WHERE tweet.tweet_id=${tweetId};`;
    const tweetUserId8 = await db.get(userTweet8);
    const userQuery8 = `SELECT follower.following_user_id FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id WHERE user_id=${result8.user_id} ;`;
    const followingData8 = await db.all(userQuery8);

    if (getResult(followingData8, tweetUserId8.user_id) === true) {
      const tweetQuery8 = `SELECT username  FROM (tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id ) AS T INNER JOIN user ON like.user_id=user.user_id WHERE  T.tweet_id=${tweetId}   ;`;
      const outputTweet8 = await db.all(tweetQuery8);
      response.status(200);
      console.log(outputTweet8);
      response.send(output(outputTweet8));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API8
const object = (each) => {
  return { replies: each };
};

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const username = request.username;
    const userQ9 = `SELECT user_id FROM user WHERE username='${username}';`;
    const result9 = await db.get(userQ9);
    const userTweet9 = `SELECT user.user_id FROM user INNER JOIN tweet ON user.user_id=tweet.user_id WHERE tweet.tweet_id=${tweetId};`;
    const tweetUserId9 = await db.get(userTweet9);
    const userQuery9 = `SELECT follower.following_user_id FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id WHERE user_id=${result9.user_id} ;`;
    const followingData9 = await db.all(userQuery9);

    if (getResult(followingData9, tweetUserId9.user_id) === true) {
      const tweetQuery9 = `SELECT name,reply.reply  FROM (tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id ) AS T INNER JOIN user ON reply.user_id=user.user_id WHERE  T.tweet_id=${tweetId}   ;`;
      const outputTweet9 = await db.all(tweetQuery9);
      response.status(200);

      response.send(object(outputTweet9));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const username = request.username;
  const userQ9 = `SELECT user_id FROM user WHERE username='${username}';`;
  const result9 = await db.get(userQ9);
  const dbQuery = `SELECT tweet ,COUNT(  DISTINCT like.like_id) AS likes,COUNT( DISTINCT reply.reply_id)AS replies, tweet.date_time AS dateTime FROM (tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id) AS T INNER JOIN reply ON T.tweet_id = reply.tweet_id WHERE T.user_id=${result9.user_id} GROUP BY tweet.tweet_id  ;`;
  const result = await db.all(dbQuery);
  response.status(200);
  response.send(result);
});

//API 10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const data = request.body;
  const dat = new Date();
  const dbQuery = `INSERT INTO tweet(tweet,user_id,date_time)VALUES('${data}',2,'${dat}');`;
  await db.run(dbQuery);
  response.status(200);
  response.send("Created a Tweet");
});

//API11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const dbQuery = `DELETE  FROM tweet WHERE tweet_id=${tweetId};`;
    if (dbQuery === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.status(200);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
