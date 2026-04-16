/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  env: {
    IDUN_URL: process.env.IDUN_URL || "http://localhost:8001",
    OUTPUT_DIR: process.env.OUTPUT_DIR || "../output",
  },
};
