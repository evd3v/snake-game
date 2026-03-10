import type { Context, NextFunction } from 'grammy';

const DEFAULT_ALLOWED_USER_ID = 875484579;

export function createAuthMiddleware() {
  const allowedUserId = Number(process.env.ALLOWED_TELEGRAM_USER_ID) || DEFAULT_ALLOWED_USER_ID;

  return async (ctx: Context, next: NextFunction) => {
    const userId = ctx.from?.id;

    if (userId !== allowedUserId) {
      console.log(`Unauthorized access attempt from user ${userId}`);
      await ctx.reply('Unauthorized');
      return;
    }

    await next();
  };
}
