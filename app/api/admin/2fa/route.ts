// The admin 2-step route's old address. 2-step now covers mentors and
// students too, so the code lives in /api/two-step; this keeps any page
// still open from before working.
export { GET, POST } from "@/app/api/two-step/route";

export const dynamic = "force-dynamic";
