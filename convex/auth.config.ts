export default {
  providers: [
    {
      // Paste the Issuer URL from Clerk Dashboard → JWT Templates → convex
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
};
