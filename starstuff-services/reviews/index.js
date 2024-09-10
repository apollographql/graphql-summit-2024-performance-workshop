const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const { buildSubgraphSchema } = require("@apollo/subgraph");
const {
  ApolloServerPluginDrainHttpServer,
} = require("@apollo/server/plugin/drainHttpServer");
const rateLimit = require("express-rate-limit");
const express = require("express");
const http = require("http");
const { json } = require("body-parser");
const cors = require("cors");
const { parse } = require("graphql");

const rateLimitTreshold = process.env.LIMIT || 5000;

const typeDefs = parse(`#graphql
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3"
          import: ["@key" "@external" "@provides"])

  type Mutation {
    createReview(upc: ID!, id: ID!, body: String): Review
  }

  type Review @key(fields: "id") {
    id: ID!
    body: String
    author: User @provides(fields: "username")
    product: Product
  }

  type User @key(fields: "id") {
    id: ID!
    username: String @external
    reviews: [Review]
  }

  type Product @key(fields: "upc") {
    upc: String!
    reviews: [Review]
    reviewsForAuthor(authorID: ID!): [Review]
  }
`);

const resolvers = {
  Review: {
    author(review) {
      const found = reviews.find(r => r.id === review.id);
      return found ? { __typename: "User", id: found.authorID } : null;
    },
  },
  User: {
    reviews(user) {
      return reviews.filter((review) => review.authorID === user.id);
    },
    numberOfReviews(user) {
      return reviews.filter((review) => review.authorID === user.id).length;
    },
    username(user) {
      const found = usernames.find((username) => username.id === user.id);
      return found ? found.username : null;
    },
  },
  Product: {
    reviews(product) {
      return reviews.filter((review) => review.product.upc === product.upc);
    },
    reviewsForAuthor(product, { authorID }) {
      return reviews.filter(
        (review) =>
          review.product.upc === product.upc && review.authorID === authorID
      );
    },
  },
  Mutation: {
    createReview(p, args) {
      return {
        id: args.id,
        body: args.body,
        product: { upc: args.upc },
      };
    },
  },
};

const usernames = [
  { id: "1", username: "@ada" },
  { id: "2", username: "@complete" },
];
const reviews = [
  {
    id: "1",
    authorID: "1",
    product: { upc: "1" },
    body: "Love it!",
  },
  {
    id: "2",
    authorID: "1",
    product: { upc: "2" },
    body: "Too expensive.",
  },
  {
    id: "3",
    authorID: "2",
    product: { upc: "3" },
    body: "Could be better.",
  },
  {
    id: "4",
    authorID: "2",
    product: { upc: "1" },
    body: "Prefer something else.",
  },
];

async function startApolloServer(typeDefs, resolvers) {
  // Required logic for integrating with Express
  const app = express();

  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: rateLimitTreshold,
  });

  app.use(cors());
  app.use(limiter);

  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    schema: buildSubgraphSchema([
      {
        typeDefs,
        resolvers,
      },
    ]),
    allowBatchedHttpRequests: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();
  app.use("/", cors(), json(), limiter, expressMiddleware(server));

  // Modified server startup
  const port = process.env.PORT || 4002;

  await new Promise((resolve) => httpServer.listen({ port }, resolve));
  console.log(`🚀 Reviews Server ready at http://localhost:${port}/`);
}

startApolloServer(typeDefs, resolvers);
