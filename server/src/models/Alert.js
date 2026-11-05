import mongoose from 'mongoose';

const { Schema } = mongoose;

const logSchema = new Schema(
  {
    event: { type: String, required: true },
    message: { type: String, default: '' },
    by: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const notificationSchema = new Schema(
  {
    contactName: String,
    channel: { type: String, enum: ['sms', 'email', 'in-app'] },
    to: String,
    status: { type: String, enum: ['sent', 'simulated', 'failed'] },
    error: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const pointSchema = new Schema(
  { lat: Number, lng: Number, accuracy: Number, at: { type: Date, default: Date.now } },
  { _id: false }
);

const actorSchema = { name: String, via: String };

const alertSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, default: '' },
    trackingToken: { type: String, required: true, unique: true },

    status: { type: String, enum: ['sent', 'acknowledged', 'resolved'], default: 'sent' },
    isActive: { type: Boolean, default: true },
    triggerSource: { type: String, enum: ['hold', 'tap', 'keyboard'], default: 'hold' },

    triggeredAt: { type: Date, default: Date.now },
    acknowledgedAt: Date,
    acknowledgedBy: actorSchema,
    resolvedAt: Date,
    resolvedBy: actorSchema,

    deliveryTimeMs: Number, // trigger -> all notifications dispatched
    responseTimeMs: Number, // trigger -> first acknowledgement

    location: { lat: Number, lng: Number, accuracy: Number, updatedAt: Date },
    path: { type: [pointSchema], default: [] },

    notifications: { type: [notificationSchema], default: [] },
    logs: { type: [logSchema], default: [] },

    contactUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    feedbackRating: { type: Number, min: 1, max: 5 },
  },
  { timestamps: true }
);

// A person can only have one open alert at a time (also protects against double triggers).
alertSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
alertSchema.index({ user: 1, triggeredAt: -1 });
alertSchema.index({ contactUserIds: 1, triggeredAt: -1 });
alertSchema.index({ isActive: 1, triggeredAt: -1 });

export const Alert = mongoose.model('Alert', alertSchema);
