export default {
  providers: [
    {
      // Clerk — for the main Ordena app
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
};
