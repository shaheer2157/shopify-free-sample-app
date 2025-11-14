import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    unstable_cartTransforms: true,
    removeRest: true,
  },

  // ✅ Add this block
  hooks: {
    afterAuth: async ({ session, admin }) => {
      console.log(`✅ App installed on ${session.shop}`);

      try {
        // 1️⃣ Get all functions
        const functionsRes = await admin.graphql(`
          #graphql
          query {
            shopifyFunctions(first: 10) {
              edges {
                node {
                  id
                  title
                }
              }
            }
          }
        `);

        const funcs = await functionsRes.json();
        console.log("🔍 Functions:", JSON.stringify({ funcs }));
        console.log(JSON.stringify(funcs.data.shopifyFunctions.edges, null, 2));

        // 2️⃣ Find your Cart Transformer by title
        const myFunc = funcs.data.shopifyFunctions.edges.find(
          (f) => f.node.title === "cart-transformer", // <-- change this to match your extension title
        );

        if (!myFunc) {
          console.error("❌ Cart Transform function not found in this app");
          return;
        }

        const functionId = myFunc.node.id;

        // 3️⃣ Check if it's already linked
        const checkRes = await admin.graphql(`
          #graphql
          query {
            cartTransforms(first: 10) {
              edges {
                node {
                  id
                  functionId
                }
              }
            }
          }
        `);

        const checkJson = await checkRes.json();
        const alreadyLinked = checkJson.data.cartTransforms.edges.some(
          (t) => t.node.functionId === functionId,
        );

        if (alreadyLinked) {
          console.log("ℹ️ Cart transform already registered");
          return;
        }

        // 4️⃣ Register the transform
        const createRes = await admin.graphql(`
          mutation {
            cartTransformCreate(functionId: "${functionId}") {
              cartTransform {
                id
                functionId
              }
              userErrors {
                field
                message
              }
            }
          }
        `);

        const createJson = await createRes.json();

        if (createJson.data.cartTransformCreate.userErrors.length > 0) {
          console.error(
            "❌ Cart transform registration failed:",
            createJson.data.cartTransformCreate.userErrors,
          );
        } else {
          console.log(
            "✅ Cart transform registered:",
            createJson.data.cartTransformCreate.cartTransform,
          );
        }
      } catch (err) {
        console.error("❌ Error registering cart transform:", err);
      }
    },
  },
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
