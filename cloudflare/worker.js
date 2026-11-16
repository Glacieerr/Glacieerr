// The same banner as a Cloudflare Worker, if you'd rather not use Vercel.
//   npx wrangler deploy cloudflare/worker.js --name lockscreen --compatibility-date 2026-11-01
import { GET } from '../api/lockscreen.js';

export default {
  fetch(request) {
    return GET(request);
  },
};
