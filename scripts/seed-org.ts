/**
 * Seeds Supabase's org_nodes table with the full UTAS administrative
 * structure extracted from the official organizational chart:
 *   University Council -> Vice Chancellor -> Deputy VCs -> Departments -> Sections
 * (plus Internal Audit Department, and the Assistant VC at the Branches /
 * Deans of Specialized Colleges and Academies branch-and-college templates).
 *
 * Every position below has a fixed UUID (generated once with uuidv4) baked
 * into this file, so re-running the script upserts the same 205 rows by id
 * instead of duplicating the tree. No people are assigned — every node is
 * seeded vacant (assigned_profile_id: null) and active.
 *
 * Usage: npm run seed:org
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface OrgNodeSeed {
  id: string;
  title: string;
  parent_id: string | null;
}

// Listed parent-before-child (pre-order) so a first-time run never violates
// the self-referential parent_id foreign key.
const ORG_NODES: OrgNodeSeed[] = [
  { id: "03433d28-2788-40fd-ba60-92997303806c", title: "University Council", parent_id: null },
  { id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea", title: "Vice Chancellor", parent_id: "03433d28-2788-40fd-ba60-92997303806c" },
  { id: "edb68d8f-617f-467f-a4b6-3ccd200e62e4", title: "Academic Council", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "e81ff582-8bf7-46b1-a90d-d5e43d2ebe8c", title: "Vice Chancellor's Office", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "21bc4532-0cde-4a78-b201-03facaf862fd", title: "Coordination Section", parent_id: "e81ff582-8bf7-46b1-a90d-d5e43d2ebe8c" },
  { id: "7ee49331-69c1-42ca-803e-c20fe5c05e80", title: "Follow -Up Section", parent_id: "e81ff582-8bf7-46b1-a90d-d5e43d2ebe8c" },
  { id: "50771ccf-3094-4248-b2f1-bcedfcbfc997", title: "Public Relations Section", parent_id: "e81ff582-8bf7-46b1-a90d-d5e43d2ebe8c" },
  { id: "d3247bb1-05e6-482d-bede-15aece3b1a01", title: "Consultants and Experts", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "42b96aac-c68c-42e7-bcd0-f9ae4adc03c3", title: "Legal Affairs Department", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "ce3cce5e-9cd5-4697-b271-f40c56b17d4d", title: "Legal Studies Section", parent_id: "42b96aac-c68c-42e7-bcd0-f9ae4adc03c3" },
  { id: "cc3b3c8e-6eba-469f-8ac1-1b3355c90d24", title: "Cases and Investigations Section", parent_id: "42b96aac-c68c-42e7-bcd0-f9ae4adc03c3" },
  { id: "7ec0328d-b1d4-4650-9bfc-baa3e331b708", title: "Contracts and Agreements Section", parent_id: "42b96aac-c68c-42e7-bcd0-f9ae4adc03c3" },
  { id: "724999af-8587-4caf-8cb1-1edebc3d8f19", title: "Documentation Department", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "f264f06d-bacb-4fbb-bc78-de2b2af0658d", title: "Mail Section", parent_id: "724999af-8587-4caf-8cb1-1edebc3d8f19" },
  { id: "35a9e25a-66fb-413f-806a-611d758a2c5e", title: "Documentation Management Section", parent_id: "724999af-8587-4caf-8cb1-1edebc3d8f19" },
  { id: "87a9693e-a1cb-4a67-a291-a8f29cc976e7", title: "Conservation Section", parent_id: "724999af-8587-4caf-8cb1-1edebc3d8f19" },
  { id: "8ec7e51a-e26f-4d66-8ea7-7079310264d0", title: "University Security Office", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "0fb21d22-4879-4c05-9fd4-e7d2e7abbbd0", title: "Personnel Data Section", parent_id: "8ec7e51a-e26f-4d66-8ea7-7079310264d0" },
  { id: "4fea6384-bb2f-4412-8911-bbd100f96562", title: "Facilities and Personnel Security Section", parent_id: "8ec7e51a-e26f-4d66-8ea7-7079310264d0" },
  { id: "ae945edc-641a-44f0-8b23-478828982a22", title: "Councils and Committees Department", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "c04cef1d-85be-4dee-a4ac-b9440bdbffd6", title: "Councils Section", parent_id: "ae945edc-641a-44f0-8b23-478828982a22" },
  { id: "2c499d7d-6cbd-4ccf-ad8b-7498e9db76df", title: "Committees Section", parent_id: "ae945edc-641a-44f0-8b23-478828982a22" },
  { id: "09fb1bac-d31f-4df6-b696-661ec15546de", title: "Partnership and International Cooperation Department", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "e439f556-513c-493e-8230-f7523a254551", title: "Partnership Section", parent_id: "09fb1bac-d31f-4df6-b696-661ec15546de" },
  { id: "4754554c-7bde-4aec-ab25-bb6fc09efab1", title: "International Cooperation Section", parent_id: "09fb1bac-d31f-4df6-b696-661ec15546de" },
  { id: "ec42b642-c9fc-4e4b-b0a0-aed2ca047a79", title: "Ejada Office", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "c23c1c80-e08f-48e2-8f39-f43ecfbc09d6", title: "Customer Service Department", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "300c66e5-f07d-4062-a08a-5af65523088e", title: "Request Receipt and Follow-Up Section", parent_id: "c23c1c80-e08f-48e2-8f39-f43ecfbc09d6" },
  { id: "c0944dd8-2ce3-46cc-9709-f1bbc958b11f", title: "Call Centere (Section)", parent_id: "c23c1c80-e08f-48e2-8f39-f43ecfbc09d6" },
  { id: "5d43cdc2-2204-439c-bdb2-18c5d675ca25", title: "Electronic Information Security Section", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "88f416bb-a174-40bc-9551-3299527fbb83", title: "Oman Vision Implementation Follow-Up Office", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "6c6caf07-18fe-4e77-a23a-bd71e7392bc0", title: "Planning and Development Department", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "9b59ad39-8cba-403b-870d-3b5033354731", title: "Studies and Statistics Section", parent_id: "6c6caf07-18fe-4e77-a23a-bd71e7392bc0" },
  { id: "34884761-6d01-4570-9cc4-b0269d486773", title: "Planning Section", parent_id: "6c6caf07-18fe-4e77-a23a-bd71e7392bc0" },
  { id: "03584f43-2be3-4085-b2d8-70ee2765e550", title: "Follow-Up and Development Section", parent_id: "6c6caf07-18fe-4e77-a23a-bd71e7392bc0" },
  { id: "fe6b9a34-04ca-456a-8540-3908b464fd8b", title: "Risk and Management Section", parent_id: "6c6caf07-18fe-4e77-a23a-bd71e7392bc0" },
  { id: "83769f6d-da55-4fc4-a1ab-39e65caf4b15", title: "Media and Communication Department", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "fca36ccd-e5c5-4642-a022-ac1f965556be", title: "Media Setion", parent_id: "83769f6d-da55-4fc4-a1ab-39e65caf4b15" },
  { id: "549f1b94-4ec9-47f6-a20d-df77b82dc1f4", title: "Digital Communiction Section", parent_id: "83769f6d-da55-4fc4-a1ab-39e65caf4b15" },
  { id: "21875081-f08a-4379-9d5e-da83f452602d", title: "Creative Content Section", parent_id: "83769f6d-da55-4fc4-a1ab-39e65caf4b15" },
  { id: "f0e0cd39-9d29-44d8-a0f7-1b669c649af0", title: "Quality Department", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "f16ab3b9-4c3d-4683-8c0a-eb3c046ecca0", title: "Quality and Follo w-Up Section", parent_id: "f0e0cd39-9d29-44d8-a0f7-1b669c649af0" },
  { id: "54477b90-c6df-4e80-88aa-db4bf9b63a9d", title: "Institutional Data Analysis Section", parent_id: "f0e0cd39-9d29-44d8-a0f7-1b669c649af0" },
  { id: "7b66d004-3f93-4e85-bdfd-012a29e91dd1", title: "Institutional Accreditation and Proficiency Section", parent_id: "f0e0cd39-9d29-44d8-a0f7-1b669c649af0" },
  { id: "08f50a2c-f6ea-4512-87c3-a3aa75c51580", title: "Programs and Qualifications Listing Section", parent_id: "f0e0cd39-9d29-44d8-a0f7-1b669c649af0" },
  { id: "89e016a9-bd12-400e-a48d-45e29f9a37d6", title: "Assistant Vice Chancellor at the Branches - Deans of Specialized Colleges and Academies", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "10ae677f-d69f-4134-be5a-c00bb9dd9291", title: "Assistant Vice Chancellor at the Branch", parent_id: "89e016a9-bd12-400e-a48d-45e29f9a37d6" },
  { id: "7e7a7c58-902b-4849-8264-a1348d09a23b", title: "Public Relations Section", parent_id: "10ae677f-d69f-4134-be5a-c00bb9dd9291" },
  { id: "c626dfbe-6b92-4b8c-9408-b66f6148383c", title: "Legal Affairs Section", parent_id: "10ae677f-d69f-4134-be5a-c00bb9dd9291" },
  { id: "6a73182d-d3be-4816-aa35-b84b2f760980", title: "Quality Assurance Section", parent_id: "10ae677f-d69f-4134-be5a-c00bb9dd9291" },
  { id: "d2eaa107-1624-4f32-9c47-1eb8e83f8760", title: "Mail and Documentation Section", parent_id: "10ae677f-d69f-4134-be5a-c00bb9dd9291" },
  { id: "4f3767cf-02b6-4792-99a3-d9066061f4f4", title: "Coordination and Follow-up Section", parent_id: "10ae677f-d69f-4134-be5a-c00bb9dd9291" },
  { id: "e7d01ce6-a708-4f65-975e-85c64446174e", title: "Communication and Media Section", parent_id: "10ae677f-d69f-4134-be5a-c00bb9dd9291" },
  { id: "05cf52b7-3c52-49c2-ad48-0de5024013dc", title: "University Branch Council", parent_id: "10ae677f-d69f-4134-be5a-c00bb9dd9291" },
  { id: "504b892d-7b31-45dc-86e9-443b294b8767", title: "Deputy of the Assistant Vice Chancellor for Postgraduate Studies, Scientific Research and Innovation", parent_id: "10ae677f-d69f-4134-be5a-c00bb9dd9291" },
  { id: "876c9ee0-b7dd-4f3c-a4d8-307ec1fd44bf", title: "Scientific Research Centres", parent_id: "504b892d-7b31-45dc-86e9-443b294b8767" },
  { id: "174b2963-b6ea-471b-af4e-57104cda02da", title: "Research and Consultation Department", parent_id: "504b892d-7b31-45dc-86e9-443b294b8767" },
  { id: "e3b2cd26-7d89-4a66-92a4-4b31818a8759", title: "Partnership and Entrepreneurship Section", parent_id: "504b892d-7b31-45dc-86e9-443b294b8767" },
  { id: "5ff070ff-5fc6-4cc9-ad8c-805c46ac1332", title: "Innovation and Technology Transfer Department", parent_id: "504b892d-7b31-45dc-86e9-443b294b8767" },
  { id: "b6017d17-a1c6-45ff-b2ad-649509d57b63", title: "Deputy of the Assistant Vice Chancellor for Academic Affairs", parent_id: "10ae677f-d69f-4134-be5a-c00bb9dd9291" },
  { id: "1b192ae5-1bb9-4bf5-91b3-cdcb53524639", title: "Academic Departments", parent_id: "b6017d17-a1c6-45ff-b2ad-649509d57b63" },
  { id: "3ba6f4d8-f9b8-48ad-a221-3de712bbb33f", title: "Academic Units", parent_id: "1b192ae5-1bb9-4bf5-91b3-cdcb53524639" },
  { id: "d8a6bd11-7800-40cf-a599-6cb8cb9ad8e4", title: "Continuous Education and Community Service Department", parent_id: "b6017d17-a1c6-45ff-b2ad-649509d57b63" },
  { id: "34effd7d-e49b-40ed-b8ac-3828760ca54c", title: "Preparatory Studies Centre", parent_id: "b6017d17-a1c6-45ff-b2ad-649509d57b63" },
  { id: "be60ba67-9826-46b1-80b7-df6af7ba5a35", title: "English Language Curriculum and Assessment Unit", parent_id: "34effd7d-e49b-40ed-b8ac-3828760ca54c" },
  { id: "10b5e6c7-4627-430c-917b-c4334bed7230", title: "Mathematics and Computing Skills Curriculum and Assessment Unit", parent_id: "34effd7d-e49b-40ed-b8ac-3828760ca54c" },
  { id: "9713857f-e340-4dab-a92f-c1ca4b2d78b5", title: "General Requirements Unit", parent_id: "34effd7d-e49b-40ed-b8ac-3828760ca54c" },
  { id: "edf2de5c-0c68-4ad8-b1c1-e04e18cf5892", title: "Deputy of the Assistant Vice Chancellor for Electronic Systems and Student Services", parent_id: "10ae677f-d69f-4134-be5a-c00bb9dd9291" },
  { id: "aa5a29bc-073d-4708-b074-eae958a8cacf", title: "Admissions and Registration Centre", parent_id: "edf2de5c-0c68-4ad8-b1c1-e04e18cf5892" },
  { id: "32f29044-dd3a-49de-8c26-74f20ef8af56", title: "Admissions Section", parent_id: "aa5a29bc-073d-4708-b074-eae958a8cacf" },
  { id: "67a2afe3-cfaa-4899-9756-0c1cc4180c5c", title: "Registration Section", parent_id: "aa5a29bc-073d-4708-b074-eae958a8cacf" },
  { id: "48a6ea02-6f43-4f64-8164-b3268bdc3f16", title: "Timetabling and Examination Section", parent_id: "aa5a29bc-073d-4708-b074-eae958a8cacf" },
  { id: "a2a6b4ee-f28a-4b30-9c51-a17bf263c627", title: "Student Affairs Centre", parent_id: "edf2de5c-0c68-4ad8-b1c1-e04e18cf5892" },
  { id: "af5d658e-1c58-4a77-b8db-3dca02cd69cb", title: "Student Activities Section", parent_id: "a2a6b4ee-f28a-4b30-9c51-a17bf263c627" },
  { id: "ac59493b-b19c-465b-a2dc-f32c6dcd7060", title: "Student Services Section", parent_id: "a2a6b4ee-f28a-4b30-9c51-a17bf263c627" },
  { id: "27cf30ae-4167-4b8c-a808-2c233259c9d7", title: "Guidance and Counselling Section", parent_id: "a2a6b4ee-f28a-4b30-9c51-a17bf263c627" },
  { id: "27786659-0caa-4853-8edf-d9b20264292b", title: "Training and Career Guidance Centre", parent_id: "edf2de5c-0c68-4ad8-b1c1-e04e18cf5892" },
  { id: "f25207e3-2731-4c90-ab08-066db6de9384", title: "On-the-Job Training Section", parent_id: "27786659-0caa-4853-8edf-d9b20264292b" },
  { id: "a093c3c5-ffaa-4021-a954-4d18bbf01762", title: "Career Guidance Section", parent_id: "27786659-0caa-4853-8edf-d9b20264292b" },
  { id: "c37cb9da-8fc7-4d94-8dee-7409cf504502", title: "Graduate Follow-up Section", parent_id: "27786659-0caa-4853-8edf-d9b20264292b" },
  { id: "f282bb6e-ac52-4812-aa24-71199d70d54d", title: "Information Systems and Educational Technologies Centre", parent_id: "edf2de5c-0c68-4ad8-b1c1-e04e18cf5892" },
  { id: "6ce5b38a-4e66-4c9a-8f32-e1307d55ae13", title: "Educational Technologies Section", parent_id: "f282bb6e-ac52-4812-aa24-71199d70d54d" },
  { id: "0b203a5c-1b83-4ea7-82aa-4f355542e070", title: "Networks and Information Security Section", parent_id: "f282bb6e-ac52-4812-aa24-71199d70d54d" },
  { id: "a4e53a4e-b09e-453e-9780-909206aac6ea", title: "Library Section", parent_id: "f282bb6e-ac52-4812-aa24-71199d70d54d" },
  { id: "41246a06-1659-4c27-8570-e122902f442b", title: "Systems Development and Technical Support Section", parent_id: "f282bb6e-ac52-4812-aa24-71199d70d54d" },
  { id: "c374ff72-8300-4588-8ce0-ffc6a808b390", title: "Administrative and Financial Affairs Department", parent_id: "10ae677f-d69f-4134-be5a-c00bb9dd9291" },
  { id: "2feaacfc-c05b-4260-a9c7-08bb38d03ec3", title: "Administrative Affairs Section", parent_id: "c374ff72-8300-4588-8ce0-ffc6a808b390" },
  { id: "9cac5be6-26cc-43da-bdca-ce20a4ba7bde", title: "Financial Affairs Section", parent_id: "c374ff72-8300-4588-8ce0-ffc6a808b390" },
  { id: "b9188267-173e-4531-adfe-63d2d2a34f02", title: "Human Resources Section", parent_id: "c374ff72-8300-4588-8ce0-ffc6a808b390" },
  { id: "bf45001c-4d68-445c-8ca0-fb81f0bf423d", title: "Dean of Specialized College / Academy", parent_id: "89e016a9-bd12-400e-a48d-45e29f9a37d6" },
  { id: "c7470ef3-5c2e-400b-85de-63b83bf9f95d", title: "Public Relations Section", parent_id: "bf45001c-4d68-445c-8ca0-fb81f0bf423d" },
  { id: "04f0d782-481d-411d-a6b8-28d961a44046", title: "Legal Affairs Section", parent_id: "bf45001c-4d68-445c-8ca0-fb81f0bf423d" },
  { id: "86043d2a-4789-44d6-8be8-2c634c65b96c", title: "Quality Assurance Section", parent_id: "bf45001c-4d68-445c-8ca0-fb81f0bf423d" },
  { id: "18178e8f-46f0-4e85-8799-855b49b355db", title: "Mail and Documentation Section", parent_id: "bf45001c-4d68-445c-8ca0-fb81f0bf423d" },
  { id: "af9fc625-847d-4574-9d81-911bc51951be", title: "Coordination and Follow-up Section", parent_id: "bf45001c-4d68-445c-8ca0-fb81f0bf423d" },
  { id: "7bbafb97-e35b-4419-bf75-59e6f6f117b9", title: "Communication and Media Section", parent_id: "bf45001c-4d68-445c-8ca0-fb81f0bf423d" },
  { id: "1d1b67a2-60d9-4af9-b332-16dcfaa879bb", title: "Specialized College/Academy Council", parent_id: "bf45001c-4d68-445c-8ca0-fb81f0bf423d" },
  { id: "a88e227c-cada-4ea2-bab3-074a2695d588", title: "Assistant Dean for Academic Affairs and Scientific Research", parent_id: "bf45001c-4d68-445c-8ca0-fb81f0bf423d" },
  { id: "e2354770-c945-4b8f-a513-f376ed711116", title: "Preparatory Studies Centre", parent_id: "a88e227c-cada-4ea2-bab3-074a2695d588" },
  { id: "fcc321c4-3a9b-4931-8d30-e28d4424c5e0", title: "English Language Curriculum and Assessment Unit", parent_id: "e2354770-c945-4b8f-a513-f376ed711116" },
  { id: "c15062c8-4b5b-4089-a04e-d080bdef8c0c", title: "Mathematics and Computing Skills Curriculum and Assessment Unit", parent_id: "e2354770-c945-4b8f-a513-f376ed711116" },
  { id: "ce3f5c51-3694-4876-abf4-e7935d5bb332", title: "General Requirements Unit", parent_id: "e2354770-c945-4b8f-a513-f376ed711116" },
  { id: "fea31eb5-2d3f-47a5-a9b2-0e39c8790cf5", title: "Partnership and Entrepreneurship Section", parent_id: "a88e227c-cada-4ea2-bab3-074a2695d588" },
  { id: "e601f9d0-4789-4673-a9fc-75913e0af90d", title: "Innovation and Technology Transfer Department", parent_id: "a88e227c-cada-4ea2-bab3-074a2695d588" },
  { id: "a4431b77-7308-402e-a7db-00bcc2b74212", title: "Scientific Research Centres", parent_id: "a88e227c-cada-4ea2-bab3-074a2695d588" },
  { id: "83bcb383-1629-41f5-a1ea-0555ff61a3fa", title: "Academic Departments", parent_id: "a88e227c-cada-4ea2-bab3-074a2695d588" },
  { id: "b4a1fcf3-1d44-40aa-9751-47f0cb2ae3c2", title: "Academic Units", parent_id: "83bcb383-1629-41f5-a1ea-0555ff61a3fa" },
  { id: "03f25ddb-d7fd-4bca-bd41-5bd9e8469727", title: "Continuous Education and Community Service Department", parent_id: "a88e227c-cada-4ea2-bab3-074a2695d588" },
  { id: "2a65f623-6fb3-487b-b3fc-07b635de3d3a", title: "Research and Consultation Department", parent_id: "a88e227c-cada-4ea2-bab3-074a2695d588" },
  { id: "222eb413-aee3-4590-a8b1-6bdad5ebce6a", title: "Assistant Dean for Electronic Systems and Student Services", parent_id: "bf45001c-4d68-445c-8ca0-fb81f0bf423d" },
  { id: "7f1ffab0-95ee-4b90-bd74-90faa9832c6c", title: "Admissions and Registration Centre", parent_id: "222eb413-aee3-4590-a8b1-6bdad5ebce6a" },
  { id: "2316f29b-8183-4adc-8172-897374b5072c", title: "Admissions Section", parent_id: "7f1ffab0-95ee-4b90-bd74-90faa9832c6c" },
  { id: "d58e420e-9bac-4c02-808d-736db31cca2d", title: "Registration Section", parent_id: "7f1ffab0-95ee-4b90-bd74-90faa9832c6c" },
  { id: "e3dc6deb-db70-43f5-bcfc-956b42eebe32", title: "Timetabling and Examination Section", parent_id: "7f1ffab0-95ee-4b90-bd74-90faa9832c6c" },
  { id: "09d5507b-3339-427c-ba43-470e3b9ef648", title: "Student Affairs Centre", parent_id: "222eb413-aee3-4590-a8b1-6bdad5ebce6a" },
  { id: "dc37acbd-14cb-4a73-868d-37e0e0c0c907", title: "Student Activities Section", parent_id: "09d5507b-3339-427c-ba43-470e3b9ef648" },
  { id: "44a2de0c-bb46-4e9a-aead-4ec0280c022d", title: "Student Services Section", parent_id: "09d5507b-3339-427c-ba43-470e3b9ef648" },
  { id: "65487b15-712b-4f4f-8c3a-8968c9262520", title: "Guidance and Counselling Section", parent_id: "09d5507b-3339-427c-ba43-470e3b9ef648" },
  { id: "0e620e84-306f-4335-a53b-98ebc9c59bfa", title: "Training and Career Guidance Centre", parent_id: "222eb413-aee3-4590-a8b1-6bdad5ebce6a" },
  { id: "21651aeb-6ed5-4da2-a6b1-b88c36a0a336", title: "On-the-Job Training Section", parent_id: "0e620e84-306f-4335-a53b-98ebc9c59bfa" },
  { id: "a81d1ff7-984b-4055-8cac-040991eb4556", title: "Career Guidance Section", parent_id: "0e620e84-306f-4335-a53b-98ebc9c59bfa" },
  { id: "3139dba1-ac45-4598-9470-855ac4d5bbf9", title: "Graduate Follow-up Section", parent_id: "0e620e84-306f-4335-a53b-98ebc9c59bfa" },
  { id: "8d482de2-ad50-4cd7-b2d6-41a58f2cc966", title: "Information Systems and Educational Technologies Centre", parent_id: "222eb413-aee3-4590-a8b1-6bdad5ebce6a" },
  { id: "beb94f24-9fbb-4484-b8da-b548818aca72", title: "Educational Technologies Section", parent_id: "8d482de2-ad50-4cd7-b2d6-41a58f2cc966" },
  { id: "0c52d0ad-bc3d-439a-9342-ed684e165e19", title: "Networks and Information Security Section", parent_id: "8d482de2-ad50-4cd7-b2d6-41a58f2cc966" },
  { id: "e3806ba5-410f-4500-9ec7-cf2b6743bb65", title: "Library Section", parent_id: "8d482de2-ad50-4cd7-b2d6-41a58f2cc966" },
  { id: "2018278c-1daa-42ad-891e-2e5f02e624c5", title: "Systems Development and Technical Support Section", parent_id: "8d482de2-ad50-4cd7-b2d6-41a58f2cc966" },
  { id: "ca3b1503-4d0e-4105-a572-a91d294160cc", title: "Administrative and Financial Affairs Department", parent_id: "bf45001c-4d68-445c-8ca0-fb81f0bf423d" },
  { id: "f486b0fc-bf0f-48d5-af9e-a74c4a404e38", title: "Administrative Affairs Section", parent_id: "ca3b1503-4d0e-4105-a572-a91d294160cc" },
  { id: "61d6e8da-06b5-43c9-b826-9b9f64a02dc4", title: "Financial Affairs Section", parent_id: "ca3b1503-4d0e-4105-a572-a91d294160cc" },
  { id: "88913d07-ac17-40b3-9ad9-5bd4e4a79132", title: "Human Resources Section", parent_id: "ca3b1503-4d0e-4105-a572-a91d294160cc" },
  { id: "d494779b-97ab-4bc6-98b6-43e76e42debf", title: "Deputy Vice Chancellor for Administrative and Financial Affairs", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "03788c08-6b93-49a6-afec-afd704e70018", title: "Coordination and Follow-up Section", parent_id: "d494779b-97ab-4bc6-98b6-43e76e42debf" },
  { id: "2943858c-b090-42de-9b6b-e22fcaa11653", title: "Financial Affairs Department", parent_id: "d494779b-97ab-4bc6-98b6-43e76e42debf" },
  { id: "ff5f1f01-386a-4838-9962-7c5380e51700", title: "Purchases Section", parent_id: "2943858c-b090-42de-9b6b-e22fcaa11653" },
  { id: "94c15fb8-af10-4b26-aabb-0112650d654f", title: "Expenses and Salaries Section", parent_id: "2943858c-b090-42de-9b6b-e22fcaa11653" },
  { id: "0644227d-2050-424c-89fe-461d01e08164", title: "Treasury Section", parent_id: "2943858c-b090-42de-9b6b-e22fcaa11653" },
  { id: "2cb21220-e8fb-4281-94ee-bf8535ec70f5", title: "Budget Section", parent_id: "2943858c-b090-42de-9b6b-e22fcaa11653" },
  { id: "faf0021a-42de-4f12-9cc0-5f8ef500da00", title: "Resources and Assets Department", parent_id: "d494779b-97ab-4bc6-98b6-43e76e42debf" },
  { id: "27ba2969-3c9c-46d0-85a8-b8b25a305545", title: "Revenues Development Section", parent_id: "faf0021a-42de-4f12-9cc0-5f8ef500da00" },
  { id: "c3ec8ebb-1c9a-4b3a-8bc0-b4434a78e453", title: "Revenues Section", parent_id: "faf0021a-42de-4f12-9cc0-5f8ef500da00" },
  { id: "f623c2f1-8e8f-4dee-978a-d5c8587e9588", title: "Administrative Affairs Department", parent_id: "d494779b-97ab-4bc6-98b6-43e76e42debf" },
  { id: "648d4024-c7b0-4b17-a60d-d6242cbc1ae4", title: "Services Section", parent_id: "f623c2f1-8e8f-4dee-978a-d5c8587e9588" },
  { id: "24f58df1-12d2-4e8c-b704-daf7ed186e9e", title: "Stores and Transportation Section", parent_id: "f623c2f1-8e8f-4dee-978a-d5c8587e9588" },
  { id: "a8c0e173-f5ae-4455-b86c-305a51f79830", title: "Employees Welfare Section", parent_id: "f623c2f1-8e8f-4dee-978a-d5c8587e9588" },
  { id: "320c3dda-e169-4b27-b0c1-52b36be1318b", title: "Human Resources Department", parent_id: "d494779b-97ab-4bc6-98b6-43e76e42debf" },
  { id: "d0a6a550-910a-4718-9854-025e9336534b", title: "Personnel Section", parent_id: "320c3dda-e169-4b27-b0c1-52b36be1318b" },
  { id: "403c81e8-6a0c-4cb4-ad12-ba13bc242f74", title: "Training and Qualifiction Section", parent_id: "320c3dda-e169-4b27-b0c1-52b36be1318b" },
  { id: "cb4eaac9-e604-4cb1-b770-0221d6cfd0dd", title: "Career Planning and Management Section", parent_id: "320c3dda-e169-4b27-b0c1-52b36be1318b" },
  { id: "c3c37b88-1fb2-47ce-924d-34d0d58de539", title: "Projects Department", parent_id: "d494779b-97ab-4bc6-98b6-43e76e42debf" },
  { id: "505ce13f-d06a-48f8-afc5-9c2dcef51aab", title: "Maintenance Section", parent_id: "c3c37b88-1fb2-47ce-924d-34d0d58de539" },
  { id: "2fe39824-1eea-4f4b-b4cd-6d0e4888bc05", title: "Engineering Affairs Section", parent_id: "c3c37b88-1fb2-47ce-924d-34d0d58de539" },
  { id: "662c021f-916c-48ed-b892-778ae9ab7eaa", title: "Deputy Vice Chancellor for Postgraduate Studies, Scientific Research and Innovation", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "80c7ec5d-7d41-4e03-8b53-bcb370b83bc4", title: "Coordination and Follow-up Section", parent_id: "662c021f-916c-48ed-b892-778ae9ab7eaa" },
  { id: "3f2d07d2-f76c-400a-9584-602df179bf06", title: "Deanship of Scientific Research and Consultation", parent_id: "662c021f-916c-48ed-b892-778ae9ab7eaa" },
  { id: "4c75f53e-ce17-47f8-8328-c2e2d11b24ee", title: "Research Section", parent_id: "3f2d07d2-f76c-400a-9584-602df179bf06" },
  { id: "87a905bb-083f-43d6-86b3-fb9e1c5acf82", title: "Consultation Section", parent_id: "3f2d07d2-f76c-400a-9584-602df179bf06" },
  { id: "dcca3945-0ca0-4c5f-90af-abee57d2688f", title: "Deanship of Postgraduate Studies", parent_id: "662c021f-916c-48ed-b892-778ae9ab7eaa" },
  { id: "e8a4dfa2-5956-4285-9fbd-87d62de34018", title: "Postgraduate Programs Planning and Development Section", parent_id: "dcca3945-0ca0-4c5f-90af-abee57d2688f" },
  { id: "f377227f-ad5e-4ac4-a313-c0fe2ed6e6dc", title: "Postgraduate Programs Academic Follow-up Section", parent_id: "dcca3945-0ca0-4c5f-90af-abee57d2688f" },
  { id: "60727dd8-08b5-4d15-8e07-8977fb77eed2", title: "Postgraduate Studies Assessment Section", parent_id: "dcca3945-0ca0-4c5f-90af-abee57d2688f" },
  { id: "b8e7d2ff-ea6c-4880-b05d-5797b0651c36", title: "Entrepreneurship and Industrial Relations Centre", parent_id: "662c021f-916c-48ed-b892-778ae9ab7eaa" },
  { id: "976a7601-9d8a-42ca-bffd-a007236b3b65", title: "Entrepreneurship Section", parent_id: "b8e7d2ff-ea6c-4880-b05d-5797b0651c36" },
  { id: "72f551be-8a4a-4927-b9e2-29b8567910c0", title: "Industrial Relations Section", parent_id: "b8e7d2ff-ea6c-4880-b05d-5797b0651c36" },
  { id: "ce03e8f0-4a56-4788-9412-0eb8366d16ac", title: "Innovation and Technology Transfer Centre", parent_id: "662c021f-916c-48ed-b892-778ae9ab7eaa" },
  { id: "a59e505a-1b46-499c-9873-f6a8ba9d35f2", title: "Innovation Section", parent_id: "ce03e8f0-4a56-4788-9412-0eb8366d16ac" },
  { id: "cf4c8fdf-2eb6-452d-8047-023695449b05", title: "Technology Transfer Section", parent_id: "ce03e8f0-4a56-4788-9412-0eb8366d16ac" },
  { id: "3e024ede-206d-41d5-a781-d610573d4ef4", title: "Deputy Vice Chancellor for Electronic Systems and  Student Services", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "3589cb0c-1c2f-410a-8deb-de2c5f985cf1", title: "Coordination and Follow-up Section", parent_id: "3e024ede-206d-41d5-a781-d610573d4ef4" },
  { id: "999d1aba-7a27-419b-92f9-0d7dda8b7aac", title: "Deanship of Student Affairs", parent_id: "3e024ede-206d-41d5-a781-d610573d4ef4" },
  { id: "df0f378d-0a08-4a48-ac4d-ad681cf91470", title: "Student Activities Section", parent_id: "999d1aba-7a27-419b-92f9-0d7dda8b7aac" },
  { id: "35fdafe1-2176-4723-ae19-5e576a30844a", title: "Guidance and Counselling Section", parent_id: "999d1aba-7a27-419b-92f9-0d7dda8b7aac" },
  { id: "1e58bfac-3736-437c-8179-61527ab0245a", title: "Training and Career Guidance Section", parent_id: "999d1aba-7a27-419b-92f9-0d7dda8b7aac" },
  { id: "7a0cc639-8b53-4181-8d16-57b2910aedb8", title: "Deanship of Admission and Registration", parent_id: "3e024ede-206d-41d5-a781-d610573d4ef4" },
  { id: "19cb45e8-88a8-48ba-a983-34c6e8ae3b80", title: "Admission Section", parent_id: "7a0cc639-8b53-4181-8d16-57b2910aedb8" },
  { id: "ff085d2a-8b71-4415-aabc-88d6256ab8a3", title: "Registration Section", parent_id: "7a0cc639-8b53-4181-8d16-57b2910aedb8" },
  { id: "48d35042-6ded-495e-946d-2e7b9353cff1", title: "Timetabling and Examination Section", parent_id: "7a0cc639-8b53-4181-8d16-57b2910aedb8" },
  { id: "560231d3-53a4-4afe-9143-e87b60e6bde7", title: "Information Systems and Educational Technologies Centre", parent_id: "3e024ede-206d-41d5-a781-d610573d4ef4" },
  { id: "bd791192-599d-4422-b09e-87c71923c35f", title: "Systems Development and Support Section", parent_id: "560231d3-53a4-4afe-9143-e87b60e6bde7" },
  { id: "7abb2e31-eea4-450e-9d29-3c0bcf607157", title: "Networks and Data Centre Section", parent_id: "560231d3-53a4-4afe-9143-e87b60e6bde7" },
  { id: "cb366ead-cf1d-47ce-9931-c00b5ab9efe3", title: "E-Learning Section", parent_id: "560231d3-53a4-4afe-9143-e87b60e6bde7" },
  { id: "9f9981bb-083b-461d-a9cb-d7012f4620c5", title: "Deputy Vice Chancellor for Academic Affairs", parent_id: "b6dcceb5-b997-4582-9b0c-9fffc2afc0ea" },
  { id: "146e4677-9d0f-42ad-8a22-8aed73e745ab", title: "Coordination and Follow-up Section", parent_id: "9f9981bb-083b-461d-a9cb-d7012f4620c5" },
  { id: "9957d372-df03-4186-a731-25b6e32b430a", title: "Deanship of Applied Sciences and Pharmacy College", parent_id: "9f9981bb-083b-461d-a9cb-d7012f4620c5" },
  { id: "8361ceff-be3d-4689-a568-dbc12eb27b7b", title: "Deanship of Creative ndustries College", parent_id: "9f9981bb-083b-461d-a9cb-d7012f4620c5" },
  { id: "557bc745-7337-4fdb-ac00-56c57d3069dc", title: "Deanship of Engineering and Technology College", parent_id: "9f9981bb-083b-461d-a9cb-d7012f4620c5" },
  { id: "117b72e9-06f5-47aa-8f9e-c8bdf7b7696b", title: "Deanship of Computing and Information Sciences College", parent_id: "9f9981bb-083b-461d-a9cb-d7012f4620c5" },
  { id: "e0c20643-4c3c-41d5-aafe-97126a4a65ce", title: "Deanship of Economics and Business Administration College", parent_id: "9f9981bb-083b-461d-a9cb-d7012f4620c5" },
  { id: "3f0a2cfb-31b9-4c13-99dc-4897565febd7", title: "Continuous Education and Community Service Centre", parent_id: "9f9981bb-083b-461d-a9cb-d7012f4620c5" },
  { id: "bd7a55b7-0a41-4881-91d7-8c04ab935eb3", title: "Continuous Education Section", parent_id: "3f0a2cfb-31b9-4c13-99dc-4897565febd7" },
  { id: "7ed904be-c3f3-4eff-b782-3fd27d77261f", title: "Community Service Section", parent_id: "3f0a2cfb-31b9-4c13-99dc-4897565febd7" },
  { id: "17016b27-5d7b-41e2-a199-0e9268ddd6e5", title: "Academic Programs Department", parent_id: "9f9981bb-083b-461d-a9cb-d7012f4620c5" },
  { id: "0bed9a1c-85e2-4959-b4b3-4ad86b8c8906", title: "Programs Planning and Development Section", parent_id: "17016b27-5d7b-41e2-a199-0e9268ddd6e5" },
  { id: "86c0527f-c229-46cd-a2d6-5f4bc7fb5452", title: "Academic Follow-up Section", parent_id: "17016b27-5d7b-41e2-a199-0e9268ddd6e5" },
  { id: "cc154d90-8b39-442f-a1c0-0d453a486e27", title: "Assessment Section", parent_id: "17016b27-5d7b-41e2-a199-0e9268ddd6e5" },
  { id: "553ed857-23ad-4f9a-82c9-abb7de8d0491", title: "Future Sciences Section", parent_id: "17016b27-5d7b-41e2-a199-0e9268ddd6e5" },
  { id: "5f030650-fc23-4d11-8829-a00508bd1bdf", title: "Preparatory Studies Centre", parent_id: "9f9981bb-083b-461d-a9cb-d7012f4620c5" },
  { id: "ea578305-25bd-498d-89c9-4ebd0dae3427", title: "English Language Curriculum and Assessment Unit", parent_id: "5f030650-fc23-4d11-8829-a00508bd1bdf" },
  { id: "eff7f78d-c9f6-4795-ac21-e9bb9348e7af", title: "Mathematics and Computing Skills Curriculum and Assessment Unit", parent_id: "5f030650-fc23-4d11-8829-a00508bd1bdf" },
  { id: "a1ba8b13-7a64-4d34-be91-046e52a002e4", title: "General Requirements Unit", parent_id: "5f030650-fc23-4d11-8829-a00508bd1bdf" },
  { id: "f5574220-b4b4-4c61-9bc3-950381ef38ab", title: "Internal Audit Department", parent_id: "03433d28-2788-40fd-ba60-92997303806c" },
  { id: "33ea610c-d315-46c1-b0cc-ce5357234665", title: "Expenses and Revenues Audit Section", parent_id: "f5574220-b4b4-4c61-9bc3-950381ef38ab" },
  { id: "91fecbb9-53af-469b-8f80-fc58485e1c23", title: "Administrative and Financial Audit Section", parent_id: "f5574220-b4b4-4c61-9bc3-950381ef38ab" },
  { id: "f44bd35a-8dd8-474e-acd4-305bbce8f1bb", title: "Information Systems Data Audit Section", parent_id: "f5574220-b4b4-4c61-9bc3-950381ef38ab" },
  { id: "d9621946-1b47-498c-9ed8-e97394e0680a", title: "Internal Audit Sections at the Branches and Colleges", parent_id: "f5574220-b4b4-4c61-9bc3-950381ef38ab" },
];

async function main() {
  const { error } = await supabase.from("org_nodes").upsert(
    ORG_NODES.map((node) => ({
      id: node.id,
      title: node.title,
      parent_id: node.parent_id,
      assigned_profile_id: null,
      is_active: true,
    })),
    { onConflict: "id" }
  );

  if (error) throw error;
  console.log(`Seeded ${ORG_NODES.length} org nodes.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
