/**
 * Seeds Supabase's org_nodes table with the UTAS administrative structure
 * extracted from the official organizational chart, scoped to Mustanad's own
 * branch/college:
 *   University Council -> Vice Chancellor -> Deputy VCs -> Departments -> Sections
 * (plus Internal Audit Department). The "Assistant Vice Chancellor at the
 * Branches - Deans of Specialized Colleges and Academies" branch/college
 * templates were intentionally removed — see migration 0009 — since they
 * don't apply to this branch/college.
 *
 * Every position below has a fixed UUID (generated once with uuidv4) baked
 * into this file, so re-running the script upserts the same rows by id
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
