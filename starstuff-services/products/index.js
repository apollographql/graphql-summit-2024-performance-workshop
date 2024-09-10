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
          import: ["@key"])

  type Query {
    topProducts(first: Int = 5): [Product]
  }

  type Mutation {
    createProduct(upc: ID!, name: String): Product
  }

  type Product @key(fields: "upc") {
    upc: String!
    name: String
    price: Int
    weight: Int
  }
`);

const products = [
  {
    upc: "1",
    name: "Table",
    price: 899,
    weight: 100,
  },
  {
    upc: "2",
    name: "Couch",
    price: 1299,
    weight: 1000,
  },
  {
    upc: "3",
    name: "Chair",
    price: 54,
    weight: 50,
  },
  {
    upc: "4",
    name: "Bed",
    price: 1000,
    weight: 1200
  }
];

const resolvers = {
  Product: {
    __resolveReference(object, _, info) {
      info.cacheControl.setCacheHint({ maxAge: 60 });

      return products.find(product => product.upc === object.upc);
    },
  },
  Query: {
    topProducts(parent, args, contextValue, info)  {
      info.cacheControl.setCacheHint({ maxAge: 60 });

      return products.slice(0, args.first);
    },
  },
  Mutation: {
    createProduct(_, args) {
      return {
        upc: args.upc,
        name: args.name,
      };
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
  const port = process.env.PORT || 4003;

  await new Promise((resolve) => httpServer.listen({ port }, resolve));
  console.log(`🚀 Products Server ready at http://localhost:${port}/`);
}

startApolloServer(typeDefs, resolvers);
