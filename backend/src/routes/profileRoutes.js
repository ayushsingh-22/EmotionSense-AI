import express from 'express';
import prisma from '../lib/prisma.js';

export function createProfileRouter(prisma) {
const router = express.Router();
const select = { id: true, email: true, fullName: true, avatarUrl: true, createdAt: true, updatedAt: true };
const shape = u => ({ id: u.id, email: u.email, full_name: u.fullName, avatar_url: u.avatarUrl, created_at: u.createdAt, updated_at: u.updatedAt });
router.get('/profile', async (req, res, next) => {
  try { const user = await prisma.user.findUnique({ where: { id: req.userId }, select }); return user ? res.json(shape(user)) : res.status(404).json({ error: 'User not found' }); } catch (error) { next(error); }
});
router.patch('/profile', async (req, res, next) => {
  try {
    const data = {};
    if (typeof req.body.full_name === 'string') data.fullName = req.body.full_name;
    if (typeof req.body.fullName === 'string') data.fullName = req.body.fullName;
    if (typeof req.body.avatar_url === 'string') data.avatarUrl = req.body.avatar_url;
    if (typeof req.body.avatarUrl === 'string') data.avatarUrl = req.body.avatarUrl;
    const user = await prisma.user.update({ where: { id: req.userId }, data, select });
    return res.json(shape(user));
  } catch (error) { next(error); }
});
router.get('/messages/emotion-history', async (req, res, next) => {
  try {
    const where = { userId: req.userId, role: 'user', emotion: { not: null } };
    if (req.query.range === '7days' || req.query.range === '30days') {
      const since = new Date(); since.setDate(since.getDate() - (req.query.range === '7days' ? 7 : 30)); where.createdAt = { gte: since };
    }
    if (typeof req.query.emotion === 'string' && req.query.emotion && req.query.emotion !== 'all') where.emotion = req.query.emotion;
    const messages = await prisma.message.findMany({ where, orderBy: { createdAt: 'desc' }, select: { id: true, emotion: true, emotionConfidence: true, createdAt: true } });
    res.json({ messages: messages.map(m => ({ id: m.id, emotion: m.emotion, emotion_confidence: m.emotionConfidence, created_at: m.createdAt })) });
  } catch (error) { next(error); }
});
return router;
}
export default createProfileRouter(prisma);
