import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Layout, Header, Footer,
  Card, CardGrid,
  Container, Heading, Text, Pill, Link,
} from "@noahwright/design";
import { experiences } from "../data/experiences";
import "./HomePage.css";

const AI_CREDITS = [
  "Built with help from our AI overlords 🤖",
  "Proudly AI-assisted 🤖",
  "Human ideas, robot execution 🤖",
  "Crafted by Noah + Claude 🤖",
  "50% inspiration, 50% hallucination 🤖",
];

function RotatingAiCredit() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % AI_CREDITS.length), 4000);
    return () => clearInterval(id);
  }, []);
  return (
    <Link href="/about/ai" variant="subtle">
      <Text as="span" tone="muted">{AI_CREDITS[idx]}</Text>
    </Link>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  return (
    <Layout
      header={
        <Header center={<span className="toybox-wordmark">🧸 Toy Box</span>} />
      }
      footer={
        <Footer
          left={<Text as="span" tone="muted">🎁 A box of fun stuff Noah wanted</Text>}
          right={<RotatingAiCredit />}
          bottom={
            <Text as="span" tone="muted">
              © {year} <Link href="https://noahwright.dev">Noah Wright</Link>
            </Text>
          }
          hasBottomSeparator
        />
      }
    >
      <Container padding="xl" noGutters>
        <Container padding="none" margin="none" itemSpacing="sm">
          <Heading level={1} align="center">Welcome to the Toy Box</Heading>
          <Text align="center" tone="muted" balance>
            Tiny browser-based games, toys, and experiments. Pick one and play.
          </Text>
        </Container>

        <Container padding="none" margin="none">
          <CardGrid minCardWidth="260px" gap="lg">
            {experiences.map((exp) => (
              <Card
                key={exp.id}
                title={exp.title}
                subtitle={<Pill variant="primary" size="small">{exp.category}</Pill>}
                interactive
                elevated
                onClick={() => navigate(exp.path)}
              >
                <Text tone="muted">{exp.description}</Text>
              </Card>
            ))}
          </CardGrid>
        </Container>
      </Container>
    </Layout>
  );
}
