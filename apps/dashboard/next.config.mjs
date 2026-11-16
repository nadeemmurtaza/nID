/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared design package ships TypeScript (icons, skeleton, consent
  // banner, confirm dialog) rather than a build, so Next compiles it.
  transpilePackages: ['@newax/design-tokens'],
};

export default nextConfig;
