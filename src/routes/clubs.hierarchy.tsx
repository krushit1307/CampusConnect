import { Helmet } from "react-helmet-async";
import Network from "lucide-react/dist/esm/icons/network";
import { ClubTree } from "@/components/clubs/ClubTree";

export default function ClubHierarchyRoute() {
  return (
    <>
      <Helmet>
        <title>Club Hierarchy | CampusConnect</title>
        <meta name="description" content="Interactive Organizational Chart for Campus Clubs" />
      </Helmet>

      <div className="container mx-auto p-4 py-8 md:p-8">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center border-4 border-black bg-lime">
              <Network className="h-6 w-6 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-black md:text-5xl">
                Club Hierarchy
              </h1>
              <p className="font-mono text-sm font-bold text-gray-600">
                Explore the organizational structure of student clubs and committees.
              </p>
            </div>
          </div>
        </header>

        <section className="neu-border bg-white p-4 md:p-6 shadow-[8px_8px_0_0_#000]">
          <ClubTree />
        </section>
      </div>
    </>
  );
}
