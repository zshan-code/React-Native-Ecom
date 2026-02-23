import express from "express";
import path from "path";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import cors from "cors";

import { functions, inngest } from "./config/inngest.js";

import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";

import adminRoutes from "./routes/admin.route.js";
import userRoutes from "./routes/user.route.js";
import orderRoutes from "./routes/order.route.js";
import reviewRoutes from "./routes/review.route.js";
import productRoutes from "./routes/product.route.js";
import cartRoutes from "./routes/cart.route.js";
import paymentRoutes from "./routes/payment.route.js";
import { handleWebhook } from "./controllers/payment.controller.js";


const app = express();

const __dirname = path.resolve();

// 1. Global request logger (optional but helpful)
app.use("/api", (req, res, next) => {
  console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// 2. Specialized handling for Stripe webhook (must be BEFORE any express.json())
app.post(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// 3. Regular body parsers for everything else
app.use(express.json());
app.use("/api/payment", paymentRoutes); // other routes like /create-intent
app.use(clerkMiddleware()); // adds auth object under the req => req.auth
app.use(cors({ origin: [ENV.CLIENT_URL, "http://192.168.58.133:8081"], credentials: true })); // allow both admin and mobile

app.use("/api/inngest", serve({ client: inngest, functions }));

app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "Success" });
});

// make our app ready for deployment
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../admin/dist")));

  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(__dirname, "../admin", "dist", "index.html"));
  });
}

const startServer = async () => {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log("Server is up and running");
    console.log(`🔑 Webhook secret loaded: ${ENV.STRIPE_WEBHOOK_SECRET ? ENV.STRIPE_WEBHOOK_SECRET.slice(0, 20) + "..." : "❌ NOT SET!"}`);
  });
};

startServer();
