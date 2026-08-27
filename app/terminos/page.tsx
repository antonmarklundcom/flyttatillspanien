import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { PageHero, Prose, Section } from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Términos y condiciones";
const LAST_UPDATED = "julio de 2026";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE}`,
    description: `Condiciones de uso del portal ${brand}.`,
    alternates: { canonical: `${await siteOrigin()}/terminos` },
    robots: { index: true, follow: true },
  };
}

/**
 * Baseline terms covering how the portal actually behaves: intermediation
 * disclaimer, user-generated listing content, the estimative nature of the
 * cuota/median/valuation figures, and takedown.
 *
 * TODO (founder, before launch): replace the operator paragraph with the real
 * razón social and RUC once the company is constituted, and have a Paraguayan
 * lawyer review this text — it is a reasonable starting point, not legal advice.
 */
export default async function TerminosPage() {
  const brand = await brandName();
  const origin = await siteOrigin();

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: TITLE, url: "/terminos" },
          ]),
        ]}
      />

      <PageHero
        title={TITLE}
        subtitle={`Última actualización: ${LAST_UPDATED}`}
      />

      <Section width="narrow">
        <Prose>
          <h2>1. Quiénes somos y qué es este servicio</h2>
          <p>
            {brand} es un portal de avisos inmobiliarios que opera en la
            República del Paraguay. El portal pone en contacto a quienes ofrecen
            inmuebles en venta o alquiler con quienes los buscan. No somos una
            inmobiliaria, no somos corredores ni representamos a ninguna de las
            partes, y no intervenimos en la negociación, en la seña, en el pago
            ni en la firma de ningún contrato.
          </p>

          <h2>2. Aceptación</h2>
          <p>
            Al utilizar el sitio aceptás estos términos. Si no estás de acuerdo
            con alguno de ellos, no utilices el portal. Podemos actualizar estos
            términos; la versión vigente es siempre la publicada en esta página,
            con su fecha de actualización.
          </p>

          <h2>3. Uso del portal</h2>
          <p>
            Buscar propiedades y contactar a quienes publican es gratuito y no
            requiere registro. Para publicar avisos sí es necesario crear una
            cuenta. Sos responsable de la veracidad de los datos de tu cuenta y
            de la actividad realizada desde ella, incluido el resguardo de tus
            credenciales.
          </p>
          <p>Está prohibido, entre otras conductas:</p>
          <ul>
            <li>
              publicar inmuebles sobre los que no tenés derecho de oferta o
              autorización del titular;
            </li>
            <li>
              publicar información falsa, engañosa o duplicada, o fotografías
              que no correspondan al inmueble ofrecido;
            </li>
            <li>
              publicar contenido discriminatorio, ofensivo o contrario a la
              legislación paraguaya vigente;
            </li>
            <li>
              extraer datos del sitio de forma automatizada (scraping),
              revenderlos o utilizarlos para contactar masivamente a usuarios;
            </li>
            <li>
              intentar vulnerar la seguridad del sitio o interferir con su
              funcionamiento.
            </li>
          </ul>

          <h2>4. Contenido publicado por los usuarios</h2>
          <p>
            Los avisos, fotografías, precios y descripciones son cargados por
            los propios usuarios, inmobiliarias, agentes y desarrolladoras.
            Ellos son los únicos responsables de su contenido, de su exactitud y
            de contar con los derechos necesarios sobre las imágenes que suben.
            Al publicar, nos otorgás una licencia no exclusiva y gratuita para
            mostrar, redimensionar y difundir ese contenido dentro del portal y
            en la promoción del portal.
          </p>
          <p>
            No verificamos de forma independiente la titularidad de los
            inmuebles, la exactitud de los precios ni las condiciones de las
            operaciones ofrecidas. Podemos moderar, editar el formato,
            despublicar o eliminar avisos que incumplan estos términos, estén
            desactualizados o resulten duplicados, sin que ello genere derecho a
            indemnización.
          </p>

          <h2>5. Estimaciones, precios de referencia y cuotas</h2>
          <p>
            El portal publica valores estimados: medianas de precio por zona,
            cuotas mensuales aproximadas y rangos de tasación. Se calculan
            automáticamente a partir de los avisos publicados y de las
            condiciones de referencia de programas de financiamiento vigentes.
          </p>
          <p>
            Estas cifras son orientativas. No constituyen una tasación oficial,
            una oferta de crédito, una recomendación de inversión ni
            asesoramiento financiero, y pueden diferir de manera significativa
            de los valores reales de una operación concreta. No otorgamos
            créditos ni intermediamos en su otorgamiento.
          </p>

          <h2>6. Responsabilidad</h2>
          <p>
            El portal se ofrece «tal como está». Hacemos un esfuerzo razonable
            por mantenerlo disponible y actualizado, pero no garantizamos la
            continuidad del servicio ni la ausencia de errores. En la máxima
            medida permitida por la ley, no respondemos por daños derivados de
            operaciones acordadas entre usuarios, de la información publicada
            por terceros ni de decisiones tomadas en base a las estimaciones del
            sitio.
          </p>
          <p>
            Antes de entregar dinero o firmar documentos, verificá la
            documentación del inmueble y la identidad de la contraparte con un
            escribano público.
          </p>

          <h2>7. Propiedad intelectual</h2>
          <p>
            El nombre, el logotipo, el diseño, el software y los contenidos
            elaborados por el portal —incluidos los informes de precios de
            referencia— nos pertenecen y no pueden reproducirse sin
            autorización, salvo la cita con atribución y enlace a la fuente.
          </p>

          <h2>8. Planes y pagos</h2>
          <p>
            La publicación de avisos es gratuita. Los servicios de visibilidad
            preferente son opcionales y se contratan por separado, con las
            condiciones, la vigencia y el precio informados al momento de la
            contratación. No cobramos comisión sobre las operaciones cerradas
            entre las partes.
          </p>

          <h2>9. Denuncias y bajas de contenido</h2>
          <p>
            Si un aviso infringe tus derechos, contiene datos falsos o utiliza
            fotografías tuyas sin autorización, escribinos desde la{" "}
            <Link href="/contacto">página de contacto</Link> indicando el enlace
            del aviso y el motivo. Revisamos los reclamos y damos de baja el
            contenido cuando corresponde.
          </p>

          <h2>10. Ley aplicable</h2>
          <p>
            Estos términos se rigen por las leyes de la República del Paraguay.
            Cualquier controversia se someterá a los tribunales ordinarios de la
            ciudad de Asunción.
          </p>
        </Prose>
      </Section>
    </main>
  );
}
