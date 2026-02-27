---
seo:
  title: OmniPaw - Ihe Nchịkwa Ọtụtụ Ndị Ọrụ Nke Nchekwa
  description: Ihe nchịkwa ọrụ ndị ọrụ nke na-achịkwa nke ọma, nwere ike ibugharị, ma nwee ihe àmà nke cryptography.
---

::u-page-hero
#title
Ihe nchịkwa ọrụ nke nchekwa maka [sistemu ndị ọrụ onwe ha]{.text-primary}.

#description
OmniPaw bụ ihe nchịkwa ọrụ ọtụtụ ndị ọrụ nke emebere maka ntugharị zuru ezu. Kwụsị idebughị ihe ndị na-adịghị atụ anya ma bido igosipụta mmekọrịta ọrụ ọ bụla ọrụ nke ọma site na ntugharị 100% nke nchekwa.

#links
 :::u-button
 ---
 color: brand-cyan
 size: xl
 to: /ig/getting-started/introduction
 trailing-icon: i-lucide-arrow-right
 ---
 Bido Ugbu A
 :::

 :::u-button
 ---
 color: neutral
 icon: simple-icons-github
 size: xl
 to: https://github.com/OmniPaw/OmniPaw
 variant: outline
 ---
 Nyee Star na GitHub
 :::

#headline
:::u-button
---
size: sm
to: /ig/getting-started/architecture
variant: outline
---
Nkọwa Nhazi Nchekwa →
:::
::

::u-page-section
:::u-page-grid
::::u-page-card
---
spotlight: true
class: group col-span-2 lg:col-span-1
---
:::div{.flex.items-center.justify-center.h-48}
:u-icon{name="i-lucide-history" class="w-24 h-24 text-brand-cyan group-hover:scale-110 transition-transform"}
:::

#title
Mweghachi 100% nke a pụrụ ịtụkwasị obi

#description
Lagharịa azụ n’ọrụ agent ọ bụla iji nyochaa nke ọma ihe kpatara njehie. Enweghịzi njehie “o rụrụ otu oge” — ọ bụrụ na o mere, ị nwere ike imegharịa ya kpọmkwem otu o siri mee.
::::


::::u-page-card
---
spotlight: true
class: col-span-2
target: _blank
to: https://ui.nuxt.com
---
  :::::OmniTracePreview
  :::::

#title
Nchọpụta na Ihe Akaebe Cryptographic

#description
Mgbanwe ọnọdụ ọ bụla, ojiji ebe nchekwa, na ọrụ ngwaọrụ niile na-enweta hash ozugbo. Igosipụta ntụkwasị obi nke omume agent ugbu a bụ nkwa mgbakọ na mwepụ, ọ bụghị naanị ndekọ log.
::::


::::u-page-card
---
spotlight: true
class: col-span-2
---
  :::::tabs
    ::::::tabs-item{.mt-5 icon="i-lucide-shield-check" label="Iwu Nchedo"}
      :::::::div{.flex.flex-col.gap-4}
        ::::::::note{.my-0}
        **INV-03**: A manyere nkewa SharedStore. E gbochiri ịpụ data n’etiti agent.
        ::::::::

        ::::::::tip{.my-0}
        **INV-15**: A kwadoro Akaebe Ọrụ. Usoro replay kwekọrọ kpamkpam na Live.
        ::::::::

        ::::::::warning{.my-0}
        **INV-09**: Mgbochi Zombie rụrụ ọrụ. Agent kwụsịrị enweghị ike ịgbanwe state.
        ::::::::

        ::::::::caution{.my-0}
        **INVARIANT_BREACH**: Kernel Panic malitere. A gbochiri oku ngwaọrụ na-adịghị ikike.
        ::::::::
      :::::::
    ::::::

    ::::::tabs-item
    ---
    class: mt-5 mb-2 text-xs overflow-x-auto
    icon: i-lucide-code
    label: Nyocha Logic
    ---
    ```typescript
    // Nyocha Iwu siri ike
    kernel.on('INVARIANT_CHECK', (state) => {
      if (!proofUtility.verifyIntegrity(state)) {
        throw new KernelPanic("Achọpụtara mmebi state");
      }
    });
    ```
    ::::::
  :::::

#title
Iwu Isi 15

#description
OmniPaw na-ele ọrụ agent anya dịka sistemụ arụmọrụ nwere state. Iwu isi 15 a na-enyocha kpọmkwem na-eme ka ntụkwasị obi zuru oke. Mmebi ọ bụla na-ebute Kernel Panic nchekwa iji gbochie nsogbu na-enweghị atụ.
::::


::::u-page-card
---
class: col-span-2 md:col-span-1
---
:::div{.flex.items-center.justify-center.h-48}
:u-icon{name="i-lucide-container" class="w-24 h-24 text-brand-blue"}
:::

#title
Nkewa Docker maka Nchedo Ngwaọrụ

#description
Gbaa ngwaọrụ `bash`, `python`, ma ọ bụ `filesystem` n’ime container Docker nwa oge. Nkewa zuru oke n’ogo host maka ọrụ ngwaọrụ agent na-enweghị ihe ize ndụ.
::::


::::u-page-card
---
spotlight: true
class: col-span-2 md:col-span-1 min-h-[450px]
---
  ::::::OmniTelemetryPreview
  ::::::

#title
Telemetry wuru n’ime ya [OpenTelemetry]{.text-primary}

#description
Mbupụ native maka traces na metrics. Jikọọ OmniPaw ozugbo na Jaeger, Zipkin, ma ọ bụ Prometheus maka nlele enterprise dị elu.
::::


::::u-page-card
---
spotlight: true
class: col-span-2
---
  ::::::OmniSwarmPreview
  ::::::

#title
Njikwa Swarm

#description
Ozi agent-na-agent dị elu, ịhọpụta onye ndu, na usoro nkwenye (MAP_REDUCE, PIPELINE, CONSENSUS) wuru ozugbo n’ime kernel bus.
::::


::::u-page-card
---
spotlight: true
class: col-span-2
---
  :::::OmniConfigPreview
  :::::

#title
Nhazi OS a pụrụ ịgbanwe kpamkpam

#description
Melite oke ebe nchekwa, oke ọsọ (rate limits), na usoro ikike n’ozuzu. Hazie sistemụ agent gị ka o kwekọọ na mkpa nchekwa na ego gị.
::::


::::u-page-card
---
spotlight: true
class: col-span-2 lg:col-span-1
---
  :::::div{.flex-1.flex.flex-col.items-center.justify-center.py-8.text-center}
    ::::::div{.flex.flex-col.gap-3.w-full.max-w-xs}
      :::::::u-button
      ---
      block: true
      color: brand-cyan
      size: lg
      to: /en/getting-started/quickstart
      trailing-icon: i-lucide-arrow-right
      ---
      Wuo Kernel Gị
      :::::::

      :::::::u-button
      ---
      block: true
      color: neutral
      icon: simple-icons-github
      size: lg
      target: _blank
      to: https://github.com/OmniPaw/OmniPaw
      variant: outline
      ---
      Lee na GitHub
      :::::::
    ::::::
  :::::

#title
Ị dịla [Njikere]{.text-primary} iwulite?

#description
Nyochaa oyi akwa ọrụ agent AI kacha echebe, nke a pụrụ ịtụkwasị obi, na nke a pụrụ imegharị nke ọma nke e wuru ruo taa.
::::

:::
::