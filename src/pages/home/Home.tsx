import FAQSection from "./components/FAQSection"
import FeaturesSection from "./components/FeaturesSection"
import HeroFeatures from "./components/HeroFeatures"
import HeroSection from "./components/HeroSection"
import TestimonialsSection from "./components/TestimonialsSection"

export default function Home() {
  return (
    <div>
      <HeroSection />
      <HeroFeatures />
      <FeaturesSection />
      <TestimonialsSection />
      <FAQSection />
      {/* <AllPricing /> */}
    </div>
  )
}
