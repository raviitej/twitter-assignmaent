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
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const dbQuery = `INSERT INTO user(name,username,password,gender)VALUES('${username}','${name}','${hashedPassword}','${gender}');`;
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
  const dbQuery = `SELECT username,tweet,date_time As dateTime FROM user NATURAL JOIN tweet LIMIT 4 ;`;
  const result = await db.all(dbQuery);
  response.status(200);
  response.send(result);
});

//API4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const dbQuery = `SELECT name FROM user INNER JOIN follower ON user_id = following_user_id;`;
  const result = await db.all(dbQuery);
  response.status(200);
  response.send(result);
});

//API5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const dbQuery = `SELECT name FROM user INNER JOIN follower ON user_id = follower_user_id;`;
  const result = await db.all(dbQuery);
  response.status(200);
  response.send(result);
});

//API6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const dbQuery = `SELECT tweet,SUM(like_id) AS likes,SUM(reply_id) AS replies,date_time As dateTime FROM (tweet NATURAL JOIN like) AS T NATURAL JOIN reply WHERE tweet_id=${tweetId};`;
  const result = await db.all(dbQuery);
  if (result[0].tweet === null) {
    response.status(400);
    response.send("Invalid Request");
  } else {
    response.status(200);
    response.send(result);
  }
});

//API 7

const output = (each) => {
  return { likes: each };
};

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const dbQuery = `SELECT username FROM (tweet NATURAL JOIN like ) AS T NATURAL JOIN user WHERE tweet_id=${tweetId};`;
    const result = await db.all(dbQuery);
    if (result[0] === undefined) {
      response.status(400);
      response.send("Invalid Request");
    } else {
      response.status(200);
      response.send(output(result));
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
    const dbQuery = `SELECT name,reply FROM (tweet NATURAL JOIN reply) AS T NATURAL JOIN user WHERE tweet_id=${tweetId};`;
    const result = await db.all(dbQuery);
    if (result[0] === undefined) {
      response.status(400);
      response.send("Invalid Request");
    } else {
      response.status(200);
      response.send(object(result));
    }
  }
);

//API9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const dbQuery = `SELECT tweet,SUM(like_id) AS likes,SUM(reply_id) AS replies,date_time As dateTime FROM (tweet NATURAL JOIN like) AS T NATURAL JOIN reply`;
  const result = await db.all(dbQuery);
  response.status(200);
  response.send(result);
});

//API 10

app.post("/user/tweets/", async (request, response) => {
  const data = request.body;
  const dat = new Date();
  const dbQuery = `INSERT INTO tweet(tweet,user_id,date_time)VALUES('${data}',2,'${dat}');`;
  await db.run(dbQuery);
  response.status(200);
  response.send("Created a Tweet");
});

//API11
app.delete("/tweets/:tweetId/", async (request, response) => {
  const { tweetId } = request.params;
  const dbQuery = `DELETE  FROM tweet WHERE tweet_id=${tweetId};`;
  if (dbQuery === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.status(200);
    response.send("Tweet Removed");
  }
});

module.exports = app;
