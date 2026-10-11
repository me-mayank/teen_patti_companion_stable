const { z } = require('zod');

const createGameSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Game name is required').max(80),
    mode: z.enum(['CLASSIC', 'JOKER']).default('CLASSIC'),
    bootAmount: z.number().int().min(1, 'Boot amount must be at least 1').max(1000000),
    maxBetMultiplier: z.number().int().min(1).max(100).default(5),
  }),
});

const turnOrderSchema = z.object({
  body: z.object({
    orderedUserIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid player ID')).min(2, 'At least 2 players required').max(6, 'At most 6 players allowed'),
  }),
});

module.exports = {
  createGameSchema,
  turnOrderSchema,
};
