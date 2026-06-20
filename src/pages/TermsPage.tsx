import { LegalPage, LegalH2 } from '../components/LegalPage';

/**
 * UTKAST – Användarvillkor. Måste granskas av kvalificerad person innan
 * publicering. Platshållare [I HAKPARENTES] och "(bekräfta)" ska fyllas i/bekräftas.
 */
export default function TermsPage() {
  return (
    <LegalPage title="Användarvillkor">
      <p>
        Dessa villkor gäller när du använder Enkel Etikett ("tjänsten"). Genom att skapa ett konto
        eller använda tjänsten godkänner du villkoren.
      </p>

      <section className="flex flex-col gap-2">
        <LegalH2>1. Om tjänsten</LegalH2>
        <p>
          Enkel Etikett är ett verktyg för att utforma, förhandsgranska och skriva ut
          produktetiketter för bagerier. Tjänsten tillhandahålls av [KONTROLLANT-NAMN],
          [ORG-NR ELLER PERSONNUMMER / EJ TILLÄMPLIGT].
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>2. Konto och ansvar</LegalH2>
        <p>
          Du ansvarar för att uppgifterna i ditt konto är korrekta och för att hålla dina
          inloggningsuppgifter skyddade. Du ansvarar för all aktivitet som sker via ditt konto.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>3. Ansvar för etiketter och livsmedelsinformation</LegalH2>
        <p>
          <strong>
            Du ansvarar ensam för att de etiketter du skapar är korrekta och uppfyller alla
            tillämpliga lagkrav.
          </strong>{' '}
          Det inkluderar – men är inte begränsat till – korrekt allergendeklaration,
          ingrediensförteckning, näringsvärden, datummärkning och alla skyldigheter enligt
          EU-förordning nr 1169/2011 om livsmedelsinformation till konsumenterna (FIC) samt övrig
          tillämplig livsmedelslagstiftning.
        </p>
        <p>
          Enkel Etikett tillhandahåller endast ett verktyg för att utforma och skriva ut etiketter.
          Eventuella hjälpfunktioner (t.ex. allergenmarkering eller ingrediensförslag) är ett stöd
          och <strong>ingen garanti</strong> för att resultatet är fullständigt, korrekt eller
          rättsligt förenligt. Vi lämnar inga garantier för att en etikett som skapats med tjänsten
          uppfyller lagkrav, och du måste själv granska och verifiera varje etikett innan den
          används. Vi ansvarar inte för felaktig, ofullständig eller bristande märkning eller för
          följder av sådan märkning.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>4. Tillåten användning</LegalH2>
        <p>
          Du får inte använda tjänsten för olagliga ändamål, försöka kringgå säkerhet, störa driften
          eller göra intrång i andras rättigheter.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>5. Avgifter och betalning</LegalH2>
        <p>
          Vissa funktioner kan kräva en betald prenumeration. Betalningar hanteras av Stripe.
          Villkor för pris, fakturering och uppsägning anges i samband med köpet. (bekräfta när
          betalplan införs)
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>6. Immateriella rättigheter</LegalH2>
        <p>
          Du behåller rättigheterna till det innehåll du skapar. Rättigheterna till själva tjänsten,
          inklusive programvara och design, tillhör [KONTROLLANT-NAMN].
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>7. Ansvarsbegränsning</LegalH2>
        <p>
          Tjänsten tillhandahålls "i befintligt skick" utan garantier av något slag. I den
          utsträckning lagen tillåter ansvarar vi inte för indirekta skador, utebliven vinst eller
          dataförlust som uppstår vid användning av tjänsten. (bekräfta omfattning)
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>8. Avslutande av konto</LegalH2>
        <p>
          Du kan när som helst radera ditt konto under <strong>Konto</strong>. Vi kan stänga av
          konton som bryter mot dessa villkor.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>9. Ändringar av villkoren</LegalH2>
        <p>Vi kan uppdatera villkoren. Väsentliga ändringar meddelas i tjänsten eller via e-post.</p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>10. Tillämplig lag</LegalH2>
        <p>Svensk lag tillämpas på dessa villkor. (bekräfta ev. tvistelösning/forum)</p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>11. Kontakt</LegalH2>
        <p>Frågor om villkoren: [KONTAKT-EMAIL].</p>
      </section>
    </LegalPage>
  );
}
