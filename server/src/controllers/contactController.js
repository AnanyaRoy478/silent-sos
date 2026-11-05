import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { cleanStr, isEmail, isPhone, normalizePhone, PHONE_HINT } from '../utils/validate.js';

function parseContact(body) {
  const name = cleanStr(body.name, 80);
  const relationship = cleanStr(body.relationship, 40);
  const phone = normalizePhone(body.phone);
  const email = cleanStr(body.email, 120).toLowerCase();

  if (!name) throw new HttpError(400, 'Enter the contact’s name.');
  if (!phone && !email) throw new HttpError(400, 'Add a phone number or an email so we can reach this contact.');
  if (phone && !isPhone(phone)) throw new HttpError(400, PHONE_HINT);
  if (email && !isEmail(email)) throw new HttpError(400, 'Enter a valid email address.');

  return {
    name,
    relationship,
    phone,
    email,
    channels: {
      sms: !!phone && body.channels?.sms !== false,
      email: !!email && body.channels?.email !== false,
    },
  };
}

export const list = (req, res) => res.json({ contacts: req.user.toClient().emergencyContacts });

export const add = asyncHandler(async (req, res) => {
  if (req.user.emergencyContacts.length >= 10) throw new HttpError(400, 'You can add up to 10 trusted contacts.');
  req.user.emergencyContacts.push(parseContact(req.body));
  await req.user.save();
  res.status(201).json({ contacts: req.user.toClient().emergencyContacts });
});

export const update = asyncHandler(async (req, res) => {
  const contact = req.user.emergencyContacts.id(req.params.id);
  if (!contact) throw new HttpError(404, 'Contact not found.');
  contact.set(parseContact(req.body));
  await req.user.save();
  res.json({ contacts: req.user.toClient().emergencyContacts });
});

export const remove = asyncHandler(async (req, res) => {
  const contact = req.user.emergencyContacts.id(req.params.id);
  if (!contact) throw new HttpError(404, 'Contact not found.');
  contact.deleteOne();
  await req.user.save();
  res.json({ contacts: req.user.toClient().emergencyContacts });
});
