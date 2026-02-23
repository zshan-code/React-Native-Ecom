import Stripe from "stripe";
import { ENV } from "../config/env.js";
import { User } from "../models/user.model.js";
import { Product } from "../models/product.model.js";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { PendingOrder } from "../models/pending-order.model.js";

const stripe = new Stripe(ENV.STRIPE_SECRET_KEY);

export async function createPaymentIntent(req, res) {
  try {
    const { cartItems, shippingAddress } = req.body;
    const user = req.user;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    let subtotal = 0;
    const validatedItems = [];

    for (const item of cartItems) {
      const product = await Product.findById(item.product._id);
      if (!product) {
        return res.status(404).json({ error: `Product ${item.product.name} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }
      subtotal += product.price * item.quantity;
      validatedItems.push({
        product: product._id.toString(),
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.images[0],
      });
    }

    const shipping = 10.0;
    const tax = subtotal * 0.08;
    const total = subtotal + shipping + tax;

    if (total <= 0) {
      return res.status(400).json({ error: "Invalid order total" });
    }

    // Find or create the Stripe customer
    let customer;
    if (user.stripeCustomerId) {
      customer = await stripe.customers.retrieve(user.stripeCustomerId);
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { clerkId: user.clerkId, userId: user._id.toString() },
      });
      await User.findByIdAndUpdate(user._id, { stripeCustomerId: customer.id });
    }

    // Create payment intent — NO large metadata here (Stripe has a 500-char limit per value)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: "usd",
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      metadata: { app: "ecomstore" },
    });

    // Save full order data in our DB, keyed by paymentIntentId
    await PendingOrder.create({
      paymentIntentId: paymentIntent.id,
      userId: user._id,
      clerkId: user.clerkId,
      orderItems: validatedItems,
      shippingAddress,
      totalPrice: parseFloat(total.toFixed(2)),
    });

    console.log(`💳 Payment intent created: ${paymentIntent.id}`);
    console.log(`� PendingOrder saved in DB for: ${paymentIntent.id}`);

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: "Failed to create payment intent" });
  }
}

export async function handleWebhook(req, res) {
  console.log("🔔 [STRIPE WEBHOOK] Incoming request...");
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, ENV.STRIPE_WEBHOOK_SECRET);
    console.log(`✅ [STRIPE WEBHOOK] Event verified: ${event.id} [${event.type}]`);
  } catch (err) {
    console.error(`❌ [STRIPE WEBHOOK] Signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    console.log(`💰 [STRIPE WEBHOOK] Payment Succeeded: ${paymentIntent.id}`);

    try {
      // Look up order data from our DB (avoids Stripe metadata size limits)
      const pending = await PendingOrder.findOne({ paymentIntentId: paymentIntent.id });

      if (!pending) {
        console.log(`⚠️ [STRIPE WEBHOOK] No pending order found for PI: ${paymentIntent.id}`);
        return res.json({ received: true });
      }

      // Prevent duplicate orders
      const existingOrder = await Order.findOne({ "paymentResult.id": paymentIntent.id });
      if (existingOrder) {
        console.log(`⚠️ [STRIPE WEBHOOK] Duplicate - order already exists for: ${paymentIntent.id}`);
        await PendingOrder.deleteOne({ paymentIntentId: paymentIntent.id });
        return res.json({ received: true });
      }

      console.log("🏗️ [STRIPE WEBHOOK] Creating order...");

      const order = await Order.create({
        user: pending.userId,
        clerkId: pending.clerkId,
        orderItems: pending.orderItems,
        shippingAddress: pending.shippingAddress,
        paymentResult: { id: paymentIntent.id, status: "succeeded" },
        totalPrice: pending.totalPrice,
      });

      console.log(`🎉 [STRIPE WEBHOOK] Order created: ${order._id}`);

      // Update product stock
      for (const item of pending.orderItems) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
      }

      // Clean up pending order
      await PendingOrder.deleteOne({ paymentIntentId: paymentIntent.id });
      console.log("✨ [STRIPE WEBHOOK] Done. PendingOrder cleaned up.");
    } catch (error) {
      console.error("💥 [STRIPE WEBHOOK] ORDER CREATION FAILED:", error.message);
      if (error.name === "ValidationError") {
        console.error("🔍 Validation Details:", error.message);
      }
    }
  } else {
    console.log(`ℹ️ [STRIPE WEBHOOK] Ignoring: ${event.type}`);
  }

  res.json({ received: true });
}
