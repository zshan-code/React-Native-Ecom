import mongoose from "mongoose";

// Temporary storage for order data while payment is being processed.
// Saves the full order details keyed by Stripe paymentIntentId so the
// webhook can retrieve them without relying on Stripe metadata limits.
const pendingOrderSchema = new mongoose.Schema(
    {
        paymentIntentId: { type: String, required: true, unique: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        clerkId: { type: String, required: true },
        orderItems: { type: Array, required: true },
        shippingAddress: { type: Object, required: true },
        totalPrice: { type: Number, required: true },
    },
    { timestamps: true }
);

export const PendingOrder = mongoose.model("PendingOrder", pendingOrderSchema);
