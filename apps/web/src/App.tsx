import { Footer } from "./components/layout/Footer";
import { Header } from "./components/layout/Header";
import { Hero } from "./features/hero/Hero";
import { HowItWorks } from "./features/how-it-works/HowItWorks";
import { Overview } from "./features/overview/Overview";
import { Terminal } from "./features/terminal/Terminal";

export function App() {
  return (
    <>
      <Header />
      <main id="top">
        <Hero />
        <Overview />
        <Terminal />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
