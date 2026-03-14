import { useNavigate } from "react-router-dom";
import { Layout, Header, Footer, Card, CardGrid } from "@noahwright/design";
import { experiences } from "../data/experiences";
import "./HomePage.css";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <Layout
      header={
        <Header center={<span className="toybox-wordmark">🧸 Toy Box</span>} />
      }
      footer={
        <Footer
          bottom={
            <span style={{ fontSize: "var(--text-sm)", opacity: 0.5 }}>
              A place for fun little side projects
            </span>
          }
        />
      }
    >
      <div className="homepage">
        <div className="homepage__intro">
          <h1 className="homepage__title">Welcome to the Toy Box</h1>
          <p className="homepage__subtitle">
            Tiny browser-based games, toys, and experiments. Pick one and play.
          </p>
        </div>

        <CardGrid minCardWidth="260px" gap="lg">
          {experiences.map((exp) => (
            <Card
              key={exp.id}
              title={exp.title}
              subtitle={
                <span className="homepage__card-category">{exp.category}</span>
              }
              interactive
              elevated
              onClick={() => navigate(exp.path)}
            >
              <p className="homepage__card-description">{exp.description}</p>
            </Card>
          ))}
        </CardGrid>
      </div>
    </Layout>
  );
}
