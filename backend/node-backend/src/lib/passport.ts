import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import { Strategy as GitLabStrategy } from 'passport-gitlab2';
import { prisma } from '../lib/prisma';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

/** Upsert a user from any OAuth profile into the DB. */
async function upsertUser(
  provider: string,
  providerId: string,
  email: string,
  name: string,
  avatar: string | undefined,
) {
  return prisma.user.upsert({
    where: { provider_providerId: { provider, providerId } },
    update: { name, avatar },
    create: { email, name, avatar, provider, providerId },
  });
}

type OAuthDone = (err: any, user?: any) => void;

// ─── Google ───────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: `${BASE_URL}/api/auth/google/callback`,
    },
    async (_at, _rt, profile, done) => {
      try {
        const user = await upsertUser(
          'google',
          profile.id,
          profile.emails?.[0]?.value || '',
          profile.displayName,
          profile.photos?.[0]?.value,
        );
        done(null, user);
      } catch (e) { done(e); }
    },
  ),
);

// ─── GitHub ───────────────────────────────────────────────────
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackURL: `${BASE_URL}/api/auth/github/callback`,
      scope: ['user:email'],
    },
    async (_at: string, _rt: string, profile: any, done: OAuthDone) => {
      try {
        const email = profile.emails?.[0]?.value || `${profile.username}@github.noreply`;
        const user = await upsertUser(
          'github',
          String(profile.id),
          email,
          profile.displayName || profile.username,
          profile.photos?.[0]?.value,
        );
        done(null, user);
      } catch (e) { done(e); }
    },
  ),
);

// ─── Discord ──────────────────────────────────────────────────
passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
      callbackURL: `${BASE_URL}/api/auth/discord/callback`,
      scope: ['identify', 'email'],
    },
    async (_at, _rt, profile: any, done: OAuthDone) => {
      try {
        const avatar = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : undefined;
        const user = await upsertUser(
          'discord',
          profile.id,
          profile.email || `${profile.username}@discord.noreply`,
          profile.username,
          avatar,
        );
        done(null, user);
      } catch (e) { done(e); }
    },
  ),
);

// ─── LinkedIn ─────────────────────────────────────────────────
passport.use(
  new LinkedInStrategy(
    {
      clientID: process.env.LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
      callbackURL: `${BASE_URL}/api/auth/linkedin/callback`,
      scope: ['r_emailaddress', 'r_liteprofile'],
    },
    async (_at: string, _rt: string, profile: any, done: OAuthDone) => {
      try {
        const user = await upsertUser(
          'linkedin',
          profile.id,
          profile.emails?.[0]?.value || '',
          profile.displayName,
          profile.photos?.[0]?.value,
        );
        done(null, user);
      } catch (e) { done(e); }
    },
  ),
);

// ─── Microsoft ────────────────────────────────────────────────
passport.use(
  new MicrosoftStrategy(
    {
      clientID: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      callbackURL: `${BASE_URL}/api/auth/microsoft/callback`,
      scope: ['user.read'],
    },
    async (_at: string, _rt: string, profile: any, done: OAuthDone) => {
      try {
        const user = await upsertUser(
          'microsoft',
          profile.id,
          profile.emails?.[0]?.value || profile._json?.mail || '',
          profile.displayName,
          undefined,
        );
        done(null, user);
      } catch (e) { done(e); }
    },
  ),
);

// ─── Facebook ─────────────────────────────────────────────────
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID || '',
      clientSecret: process.env.FACEBOOK_APP_SECRET || '',
      callbackURL: `${BASE_URL}/api/auth/facebook/callback`,
      profileFields: ['id', 'displayName', 'emails', 'photos'],
    },
    async (_at: string, _rt: string, profile: any, done: OAuthDone) => {
      try {
        const user = await upsertUser(
          'facebook',
          profile.id,
          profile.emails?.[0]?.value || `${profile.id}@facebook.noreply`,
          profile.displayName,
          profile.photos?.[0]?.value,
        );
        done(null, user);
      } catch (e) { done(e); }
    },
  ),
);

// ─── Twitter ──────────────────────────────────────────────────
passport.use(
  new TwitterStrategy(
    {
      consumerKey: process.env.TWITTER_CONSUMER_KEY || '',
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET || '',
      callbackURL: `${BASE_URL}/api/auth/twitter/callback`,
      includeEmail: true,
    },
    async (_token: string, _tokenSecret: string, profile: any, done: OAuthDone) => {
      try {
        const user = await upsertUser(
          'twitter',
          profile.id,
          profile.emails?.[0]?.value || `${profile.username}@twitter.noreply`,
          profile.displayName,
          profile.photos?.[0]?.value,
        );
        done(null, user);
      } catch (e) { done(e); }
    },
  ),
);

// ─── GitLab ───────────────────────────────────────────────────
passport.use(
  new GitLabStrategy(
    {
      clientID: process.env.GITLAB_CLIENT_ID || '',
      clientSecret: process.env.GITLAB_CLIENT_SECRET || '',
      callbackURL: `${BASE_URL}/api/auth/gitlab/callback`,
    },
    async (_at: string, _rt: string, profile: any, done: OAuthDone) => {
      try {
        const user = await upsertUser(
          'gitlab',
          String(profile.id),
          profile.emails?.[0]?.value || profile._json?.email || '',
          profile.displayName || profile.username,
          profile.avatarUrl,
        );
        done(null, user);
      } catch (e) { done(e); }
    },
  ),
);

export default passport;
