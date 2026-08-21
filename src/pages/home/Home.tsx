import CredibilityBand from "./components/CredibilityBand"
import FAQSection from "./components/FAQSection"
import FeaturesSection from "./components/FeaturesSection"
import HeroFeatures from "./components/HeroFeatures"
import HeroSection from "./components/HeroSection"
import ProductDemoSection from "./components/ProductDemoSection"
import TestimonialsSection from "./components/TestimonialsSection"

export default function Home() {
  return (
    <div>
      <HeroSection />
      <CredibilityBand />
      <HeroFeatures />
      <ProductDemoSection />
      <FeaturesSection />
      <TestimonialsSection />
      <FAQSection />
    </div>
  )
}
