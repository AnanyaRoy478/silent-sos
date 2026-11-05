import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema } = mongoose;

const contactSchema = new Schema({
  name: { type: String, required: [true, 'Contact name is required.'], trim: true, maxlength: 80 },
  relationship: { type: String, trim: true, maxlength: 40, default: '' },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  channels: {
    sms: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
  },
});

const userSchema = new Schema(
  {
    name: { type: String, required: [true, 'Name is required.'], trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    emergencyContacts: {
      type: [contactSchema],
      default: [],
      validate: [(list) => list.length <= 10, 'You can add up to 10 trusted contacts.'],
    },
    settings: {
      triggerMode: { type: String, enum: ['hold', 'tap'], default: 'hold' },
      stealthMode: { type: Boolean, default: true },
      haptic: { type: Boolean, default: true },
      customMessage: { type: String, trim: true, maxlength: 200, default: '' },
    },
  },
  { timestamps: true }
);

userSchema.index({ phone: 1 });

userSchema.statics.hash = (password) => bcrypt.hash(password, 12);
userSchema.methods.verifyPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.toClient = function () {
  const s = this.settings || {};
  return {
    id: this.id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    settings: {
      triggerMode: s.triggerMode || 'hold',
      stealthMode: s.stealthMode !== false,
      haptic: s.haptic !== false,
      customMessage: s.customMessage || '',
    },
    emergencyContacts: this.emergencyContacts.map((c) => ({
      id: c.id,
      name: c.name,
      relationship: c.relationship,
      phone: c.phone,
      email: c.email,
      channels: { sms: c.channels?.sms !== false, email: c.channels?.email !== false },
    })),
  };
};

export const User = mongoose.model('User', userSchema);
