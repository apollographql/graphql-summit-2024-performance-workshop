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
          import: ["@key" "@shareable" "@external"])

  type Query {
    me: User
    recommendedProducts: [Product]
  }

  type User @key(fields: "id") {
    id: ID!
    name: String
    username: String @shareable
  }

  extend type Product @key(fields: "upc") {
    upc: String! @external
  }
`);

const users = [
  {
    id: "1",
    name: "Ada Lovelace",
    birthDate: "1815-12-10",
    username: "@ada",
  },
  {
    id: "2",
    name: "Alan Turing",
    birthDate: "1912-06-23",
    username: "@complete",
  },
];

const resolvers = {
  Query: {
    me(parent, args, contextValue, info) {
      info.cacheControl.setCacheHint({maxAge: 60, scope: 'PRIVATE' });
      return users[0];
    },
    recommendedProducts(parent, args, contextValue, info) {
      info.cacheControl.setCacheHint({ maxAge: 10, scope: 'PRIVATE' });

      let products = [{ upc: "1"}, { upc: "2"}, { upc: "3"}, { upc: "4"}].sort(() => Math.random() - Math.random()).slice(0, 2);
      return products;
    }
  },
  User: {
    __resolveReference(object, _, info) {
      info.cacheControl.setCacheHint({ maxAge: 60 });
      return users.find((user) => user.id === object.id);
    },
  },
};

async function startApolloServer(typeDefs, resolvers) {
  // Required logic for integrating with Express
  const app = express();

  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: rateLimitTreshold,
  });

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
  const port = process.env.PORT || 4001;

  await new Promise((resolve) => httpServer.listen({ port }, resolve));
  console.log(`🚀 Accounts Server ready at http://localhost:${port}/`);
}

startApolloServer(typeDefs, resolvers);
