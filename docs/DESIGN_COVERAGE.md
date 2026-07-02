# 🗺️ DESIGN_COVERAGE — матриця «дизайн ↔ модуль ↔ код»

> 🟢 **КОРЕКЦІЯ S6 (2026-06-25):** таблиця нижче згенерована **2026-06-22, ДО S6-фронту** і місцями
> застаріла. Після S6 РЕАЛЬНО збудовано (рядки 06/07/08/15/18, що позначені MISS/PLHD/«не існує», —
> вже IMPL): **Інбокс** master-detail в обох апках (`routes/inbox/InboxPage.tsx`) · **notification read-API**
> (`routes/notifications/` GET/PATCH/read-all) · **матриця каналів** (`/profile/telegram/connect`-сусід:
> `/profile/notifications` GET+PATCH, UI `NotificationsSection`) · **Telegram-лінк** (API `routes/telegram/`
>
> - бот `apps/bot` `/start`→link) · **email** stone+lime палітра + 3 нові шаблони (status/comment/invoice) ·
>   **Документи-таб** (генерація+PDF+«Надіслати»). Деталі — TRACKER §SPRINT 6 + `docs/modules/{06,07,08}.md`.
>   Решта таблиці — для не-S6 модулів — лишається актуальною.

> **Єдине джерело істини про РЕАЛЬНИЙ стан коду по кожному екрану.** Згенеровано наскрізним аудитом
> `design-coverage-audit` (60 агентів, adversarial-verified) · **2026-06-22**.
>
> ⚠️ **Важливо про статуси:** у `DESIGN_SPEC_FULL.md` і `docs/modules/*` позначки **`✅` / `РЕЮЗ`** означають
> **«дизайн/специфікація готові»**, а НЕ «в продакшені». Аудит показав, що багато таких позначок читаються
> як «зроблено», хоча коду немає. **Реальний стан коду — лише в цій таблиці** (колонка `Код`).

## Як читати

- **ДизСтатус** — як каже ТЗ: `РЕЮЗ` (мокап 1:1) · `РОЗШИР` (домалювати) · `НОВЕ` (нема) · `unknown`.
- **Бекенд** — чи є API під дані екрана: `yes` / `partial` / `no`.
- **Код** — РЕАЛЬНИЙ стан: 🟢 `IMPL` (жива сторінка) · 🟡 `PLHD` (заглушка-маршрут) · ⚪ `MISS` (нема).
- **Відповідність** — для реалізованих: `✅` тримається дизайну · `⚠️ RISK` відхилення (токени/верстка/стани) · `—` н/д.

## Зведення

- **Екранів усього:** 567 (по 29 модулях)
- **Код:** 🟢 85 реалізовано · 🟡 30 заглушка · ⚪ 452 нема
- **Відповідність реалізованих:** ✅ 38 ок · ⚠️ 47 RISK (виглядає/поводиться не так)
- **Drift (розбіжності доки↔реальність):** 180 підтверджено adversarial-перевіркою (14 відкинуто як хибні)

| Модуль                  | Екран                                                                      | Бекенд | Код     | Дизайн-файл / доказ            |
| ----------------------- | -------------------------------------------------------------------------- | ------ | ------- | ------------------------------ |
| 02 — Orders             | ~~Канбан · List~~ ✅ табличний реєстр (git-log свідомо замінено)           | yes    | 🟢 IMPL | OrdersPage.tsx:29,616-633      |
| 02 — Orders             | Канбан · Timeline — є, але дедлайн-бакети, НЕ Gantt (низький пріоритет)    | yes    | 🟡 PART | OrdersPage.tsx:352             |
| 02 — Orders             | ~~Вхідні / Triage~~ ✅ фільтри new/виконавець + bulk-assign у реєстрі      | yes    | 🟢 IMPL | OrdersPage.tsx:55-66,534-557   |
| 02 — Orders             | ~~Деталь v2 «Огляд»~~ ✅ закрито: вміст у сайдбарі (рішення 24.06)         | yes    | 🟢 IMPL | OrderDetailPage.tsx:123-150    |
| 02 — Orders             | ~~Тумблер requiresApproval~~ ✅ 2026-07-02: чекбокс у CreateOrderModal     | yes    | 🟢 IMPL | createWorkspaceOrder.ts:50-96  |
| 02 — Orders             | ~~Блок погодження 02-А (workspace)~~ ✅ ApprovalCard                       | yes    | 🟢 IMPL | OrderDetailPage.tsx:514-576    |
| 02 — Orders             | ~~Нове замовлення — форма~~ ✅ slice №8 (24.06)                            | yes    | 🟢 IMPL | design-v2/project/portal-orde… |
| 02 — Orders             | Деталь (Portal) compact-alt — mobile-пакет                                 | yes    | ⚪ MISS | design-v2/project/portal-scre… |
| 02 — Orders             | Mobile ×3 (portal список/деталь + workspace) — mobile-пакет                | yes    | ⚪ MISS | нуль responsive-інфри в апках  |
| 05 — Billing & Payments | ~~Модалка «Підтвердити оплату»~~ ✅ (верифік. 02.07)                       | yes    | 🟢 IMPL | BillingPage.tsx:327-501        |
| 05 — Billing & Payments | ~~Разова знижка (05-З)~~ ✅ (верифік. 02.07)                               | yes    | 🟢 IMPL | BillingPage.tsx:230-252        |
| 05 — Billing & Payments | ~~Payment terms (05-Г)~~ ✅ Settings-дефолт + модалка на проєкті           | yes    | 🟢 IMPL | ProjectDetailPage.tsx:307      |
| 05 — Billing & Payments | ~~Екран проєкту (05-ПРОЕКТИ)~~ ✅ /projects/:id (402 рядки)                | yes    | 🟢 IMPL | ProjectDetailPage.tsx, App:150 |
| 06 — Documents (PDF)    | ~~Юр-онбординг компанії~~ ✅ portal RequisitesSection + ws таб «Реквізити» | yes    | 🟢 IMPL | portal SettingsPage.tsx:350    |
| 09 — Referral           | Referral (мобільний) — mobile-пакет                                        | yes    | ⚪ MISS | ReferralsPage desktop справжня |
| 10 — Loyalty            | Manual override тіру (адмін)                                               | yes    | 🟢 IMPL | /clients/:id LoyaltySection    |
| 12 — Team & Executors   | Ростер — є (invite/ролі/capacity/zeroCost/ставка); бракує EditMemberModal  | yes    | 🟡 PART | TeamPage.tsx vs workspace-adm… |
| 12 — Team & Executors   | Картка виконавця / EditMember (роль+rate в одному місці)                   | yes    | ⚪ MISS | лише RateModal у Payouts       |
| 12 — Team & Executors   | Панель часу/прогресу на картці задачі (дані в API є)                       | yes    | ⚪ MISS | TaskBoardPage.tsx:8-30         |
| 13 — Settings           | Профіль /profile — є; «Заробіток» = EmptyState «скоро»                     | yes    | 🟡 PART | ProfilePage.tsx:24-46          |
| 20 — Admin Settings     | ~~Юр-особи агенції (LegalEntity CRUD)~~ ✅ slice №1 (24.06)                | yes    | 🟢 IMPL | SettingsPage.tsx:393           |
| 20 — Admin Settings     | ~~Селектор юр-особи~~ ✅ slice №2 (24.06)                                  | yes    | 🟢 IMPL | ProjectDetailPage.tsx:70,313   |
| 22 — Finance & Expenses | ~~Тумблер «нульова собівартість»~~ ✅ 2026-07-02 (/team)                   | yes    | 🟢 IMPL | design-v2/project/workspace-a… |
| 22 — Finance & Expenses | ~~Маржа на екрані проєкту (22-Д)~~ ✅ картка «Маржа · рік»                 | yes    | 🟢 IMPL | ProjectDetailPage.tsx:110-127  |
| 22 — Finance & Expenses | Експорт CSV — є на Reports+Finance; нема на Margin/Payouts; XLSX ніде      | yes    | 🟡 PART | ReportsPage.tsx:62-94          |
| 28 — Client Management  | ~~Таб Проєкти в client360~~ ✅ ProjectsSection                             | yes    | 🟢 IMPL | ClientDetailPage.tsx:1201      |

_Звірка з кодом 2026-07-02 (агентна верифікація всіх 28 рядків після 5 поспіль «привидів»): **17 ✅ збудовано / 4 🟡 частково / 4 ⚪ реально відсутні** (mobile-пакет ×3 екрани + картка виконавця + task-прогрес). Чесна черга найдешевших: CSV на Margin/Payouts → прогрес на TaskBoard-картках → «Заробіток» у профілі → EditMemberModal. Mobile — окремим пакетом._

## Додаток A — індекс дизайн-файлів (`design-v2/project/`)

Усього файлів: 97.

| Файл                          | Апка              | Модулі                     | Екрани                                                                                     |
| ----------------------------- | ----------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| app.jsx                       | brandbook-tooling | 14                         | App (canvas root + artboard host); WfTweaks; MiniTerminalPreview; COLOR_SCHEMES theme swi… |
| avatar-icons.jsx              | shared-shell      | 12, 28                     | WfAvatar; AvatarCatalog; role/client/dept avatar glyph system                              |
| brandbook-extras.jsx          | brandbook-tooling | 13                         | BrandbookSectionsB (sections 14-21: forms, cards, templates)                               |
| brandbook-product.jsx         | brandbook-tooling | 13                         | ProductBrandbook; WfpBBSection; BBRow (product component library catalog)                  |
| brandbook.jsx                 | brandbook-tooling | 13                         | Brandbook; BrandbookHero; BrandbookSectionsA; Swatch; TypeRow; SpacingRow; ShadowRow; Mot… |
| cats.jsx                      | brandbook-tooling | 14                         | Cat; CatMonoline; CatStamp; CatAbstract; CatCharacter; CatAscii; CatMark (brand mascot va… |
| design-canvas.jsx             | brandbook-tooling | —                          | DesignCanvas; DCViewport; DCSection; DCArtboard; DCArtboardFrame; DCFocusOverlay; DCPostI… |
| documents-screens.jsx         | shared-shell      | 06                         | DocumentsIndex; InvoiceDoc; CompletionActDoc; ReconciliationActDoc; SpecificationDoc; Con… |
| eco-nav.jsx                   | shared-shell      | —                          | EcoNav (cross-app top nav: landing/portal/workspace/documents/brandbook)                   |
| email-templates.jsx           | email             | 08, 01, 05, 02, 07, 12, 06 | EmailInvite; EmailOrderReceived; EmailInvoice; EmailPaymentOk; EmailDeadline; EmailVerify… |
| inbox-screens.jsx             | shared-shell      | 18, 03, 07                 | GlobalInbox; InboxRow; InboxDetail; InboxChatThread; InboxStatusCard; InboxDocCard; Inbox… |
| ios-frame.jsx                 | mobile            | —                          | IOSDevice; IOSStatusBar; IOSNavBar; IOSList; IOSListRow; IOSGlassPill; IOSKeyboard (nativ… |
| landing-blog.jsx              | landing           | 11, 14                     | TermPageShell; BlogIndex; BlogArticle                                                      |
| landing-booking.jsx           | landing           | 24, 14                     | BookingPage (public /book/:userSlug availability + confirmed)                              |
| landing-cases.jsx             | landing           | 11, 14                     | CaseIndex; CasePage (public case studies)                                                  |
| landing-marketing.jsx         | landing           | 14, 26                     | ServicesIndex; ServicePage; AboutPage; ContactPage; Error500                               |
| landing-pricing.jsx           | landing           | 14, 05                     | PricingPage; LegalPage (Terms/Privacy)                                                     |
| onboarding.jsx                | workspace         | 01, 13, 12, 27             | OnboardingFlow (5-step: workspace → company → team → channels → done)                      |
| order-chat.jsx                | shared-shell      | 03, 04, 02, 06             | OrderChatV2; OrderFilesV2; OrderDocsTab; OrderDetailTabs; OrderLightbox; OcMessage; Porta… |
| portal-auth.jsx               | portal            | 01                         | PortalLogin; PortalRegister; RegisterStep1; RegisterStep2; PortalForgotPassword; PortalRe… |
| portal-client-p1.jsx          | portal            | 28, 02, 05, 06             | PortalCompany; PortalServiceProjects; ProjectDetailModal; PortalBillingProjects; PortalPa… |
| portal-components.jsx         | portal            | 04, 06, 10                 | PageHeader; StatsRow; Stat; Tabs; FileRow; UploadZone; PortalDocRow; TierBadge; FilterBar… |
| portal-loyalty.jsx            | portal            | 10                         | PortalLoyalty (tier ladder + progress + bonus balance/history + rules)                     |
| portal-mobile-app.jsx         | mobile            | 02, 18, 05, 06, 10, 03     | PortalMobileApp (mobile router/shell); PMASheet (more sheet)                               |
| portal-mobile.jsx             | mobile            | 02, 03, 18, 05, 06, 10, 01 | PortalMobile; MobileOrders; MobileOrderChat; MobileInbox; MobileBilling; MobileDocuments;… |
| portal-order-new.jsx          | portal            | 02, 03                     | PortalOrderNew (new-order form); PortalOrderNewChat (guided intake chat)                   |
| portal-p2c.jsx                | portal            | 25, 09                     | PortalWalletTopup; PortalWalletV2; PortalReferralFunnel                                    |
| portal-referrals.jsx          | portal            | 09                         | PortalReferrals (referral share + funnel)                                                  |
| portal-screens.jsx            | portal            | 02, 03, 04, 06, 05         | PortalOrders; PortalOrderDetail; OrderDetailChat; OrderDetailFiles; OrderDetailDocs; Port… |
| portal-secrets.jsx            | portal            | 17                         | PortalSecrets; Reveal2FAModal; PortalAddSecretModal                                        |
| portal-settings.jsx           | portal            | 13, 01                     | SettingsNav; PortalSettingsSecurity (2FA/sessions overview)                                |
| portal-signing.jsx            | portal            | 06                         | PortalSigningFlow; WfsList; WfsReview; WfsSigned; WfsSignModal; WfsRejectModal; WfsChange… |
| portal-states.jsx             | portal            | 16, 07, 28, 21             | ErrorState; PortalMaintenance; CmdKOverlay; BellDropdown; CompanySwitcherPop; NewCompanyW… |
| portal-team.jsx               | portal            | 12, 13, 28, 07             | PortalTeam; PortalSettingsProfile; PortalSettingsCompany; PortalSettingsMembers; PortalSe… |
| product-app.jsx               | brandbook-tooling | —                          | ProductApp (portal/workspace/documents/brandbook deck); PortalSection; WorkspaceSection; … |
| product-shell.jsx             | shared-shell      | —                          | Icon; PORTAL_NAV; WORKSPACE_NAV (product chrome: sidebar nav models, accent system)        |
| proto-feedback.jsx            | brandbook-tooling | —                          | wfToast imperative API + dead-button feedback layer                                        |
| proto-modal.jsx               | brandbook-tooling | —                          | wfModal; wfConfirm imperative modal/confirm API                                            |
| prototype.jsx                 | brandbook-tooling | —                          | PrototypeApp; PortalPrototype; WorkspacePrototype; LandingPrototype; ComponentsPrototype;… |
| round4-billing.jsx            | workspace         | 05, 06, 08                 | R4Refund; R4RefundModal; R4CreditNoteDoc; R4RefundEmail; RbStepper (refund/credit-note ad… |
| round4-bot.jsx                | workspace         | 15                         | R4Bot (Telegram bot admin + broadcast composer/history); R4BotConfirm                      |
| round4-bulk.jsx               | workspace         | 20                         | R4Bulk (bulk-actions framework: selection bar, bulk-confirm, progress toast)               |
| round4-dlq.jsx                | workspace         | 21, 07                     | R4Dlq (notification DLQ + retry admin)                                                     |
| round4-integrations.jsx       | workspace         | 27, 17                     | R4Integrations (portal + workspace integrations hub); R4TokenModal (API token reveal-once) |
| round4-misc.jsx               | workspace         | 13, 19, 01                 | R4ExecSettings; R4Export; R4Onboarding; R4Forbidden; R4Diff                                |
| round4-search.jsx             | workspace         | 16                         | R4Search (full search results page: facets + grouped results); SrFacet                     |
| round4-trash.jsx              | workspace         | 20                         | R4Trash (trash/undelete soft-delete restore); R4PurgeModal                                 |
| skeletons.jsx                 | shared-shell      | —                          | Skel; SkelRow; SkelStats; SkelTable; SkelCards; DashboardSkeleton; ListSkeleton (loading-… |
| terminal-extras.jsx           | landing           | 14                         | AsciiLogoBanner; LiveCommandStrip; BootSequenceV2; AsciiPortrait; CurrentlySection; Sound… |
| terminal-pages.jsx            | landing           | 11, 14                     | ProjectPage; CompanyPage; CompanySocials (full case-study landing pages)                   |
| terminal-variant.jsx          | landing           | 14, 11                     | TerminalLanding; TerminalHero; TerminalServices; TerminalCases; TerminalProcess; Terminal… |
| tweaks-panel.jsx              | brandbook-tooling | —                          | TweaksPanel; TweakSection; TweakRow; TweakSlider; TweakToggle; TweakRadio; TweakSelect; T… |
| wordmark.jsx                  | brandbook-tooling | 14                         | Wordmark; WfPlain; WfLive; WfCat; WfMono; WfBracket; LiveWidget (brand wordmark variants)  |
| workspace-admin-settings.jsx  | workspace         | 20, 08, 13, 21             | AdminTemplates; AdminSmtp; AdminBranding; AdminNomenclature; AdminCrons; AdminSettingsTabs |
| workspace-admin.jsx           | workspace         | 20, 12, 13                 | AdminDepartments; AdminTeam; AdminPermissions; InviteMemberModal; EditMemberModal; AdminH… |
| workspace-audit.jsx           | brandbook-tooling | —                          | WorkspaceAuditMap (prototype coverage self-audit map)                                      |
| workspace-billing-hub.jsx     | workspace         | 05, 22, 25                 | WorkspaceBillingHub; WorkspacePayments (consolidated Billing hub: invoices/payments/debto… |
| workspace-board-modals.jsx    | workspace         | 02, 12                     | BoardSettingsModal (per-team columns); AddTaskModal                                        |
| workspace-board-task.jsx      | workspace         | 02, 12                     | TaskDetailModal; TaskMOverview; TaskMTime; TaskMCheck; TaskMActivity (task detail with ti… |
| workspace-board.jsx           | workspace         | 02, 12                     | WorkspaceBoard (team task kanban); BoardCard; BoardList; BoardTimeline; BoardAvatars       |
| workspace-branding.jsx        | workspace         | 20, 13, 14                 | WorkspaceBranding; BrandingTab; DomainTab; LandingTab; PortalTab; LandingDemo; BrandPrevi… |
| workspace-calendar-plus.jsx   | workspace         | 24, 23                     | WsCalendarSettings; CalLayers; CalBookingTypes; BookingTypeModal; WsLeaves; LeaveRequestM… |
| workspace-calendar.jsx        | workspace         | 24                         | CalendarMonth; CalendarWeek; CalendarDay; CalEventModal; CalRsvpModal; CalendarEmpty; Mob… |
| workspace-case-editor.jsx     | workspace         | 11                         | CaseEditorScreen (AI draft-from-order + SEO); WorkspaceCasesV2 (cases list)                |
| workspace-client360-tabs.jsx  | workspace         | 28, 05, 22, 06, 17         | C360Projects; ProjectWizard; ProjectEditModal; ClientBillingPanel; C360Finance; FinanceAc… |
| workspace-client360.jsx       | workspace         | 28, 12                     | Client360Card; C360Overview; C360People; C360PeopleModal; C360Activity (Client Card 360 -… |
| workspace-clients.jsx         | workspace         | 28, 12, 05, 17, 26         | WorkspaceClients; ClientsList; ClientCard; ClientInfo; ClientTeam; ClientOrders; ClientBi… |
| workspace-content.jsx         | workspace         | 17, 11                     | WorkspaceVault; WorkspaceBlogCMS; WorkspaceCases; VaultItem; MdSource                      |
| workspace-documents-eu.jsx    | shared-shell      | 06                         | EuInvoiceDoc; EuServiceAgreementDoc; EuServiceActDoc; EuStatementDoc; EuSowDoc; PublicInv… |
| workspace-finance.jsx         | workspace         | 22, 19                     | FinanceHub; FinanceOverview; ExpensesTab; PnlChart; ExpenseModal; PnlReport; Donut; LineC… |
| workspace-finprojects.jsx     | workspace         | 20, 12, 22, 06             | WsProjects; WsLegalEntities; WsCompensation; CompModal; WsContractTemplates; ContractEdit… |
| workspace-hubs.jsx            | workspace         | 19, 20, 12, 13             | ReportsHub; AdminSettingsHub; AdminHub; AdminTeamHub; PortalSettingsHub (clickable hub wr… |
| workspace-integrations.jsx    | workspace         | 27, 17                     | WorkspaceIntegrations; IhKeys; IhKeyModal; IhForm; IhChannels; IhConnectModal; IhWebhooks… |
| workspace-landing-hub.jsx     | workspace         | 14, 11                     | WsLandingHub; LhOverview (consolidated public-site hub)                                    |
| workspace-leads.jsx           | workspace         | 26, 27                     | WorkspaceLeads; LeadsBoard; LeadDetail; LeadConvertModal; LeadsPipelines; WfSource         |
| workspace-leave.jsx           | workspace         | 23                         | LeaveExecutor; LeaveAdmin; LeaveRequestModal; LeaveRejectModal                             |
| workspace-margin.jsx          | workspace         | 22, 19                     | MarginTab (margin breakdown by client/project/executor)                                    |
| workspace-minors.jsx          | workspace         | 01, 02, 03, 19, 18         | OAuthButtons; OrderTagsDeps; ChatRefine; RevenueReport; ChatHubRefine (M1-M5 interaction … |
| workspace-missing.jsx         | workspace         | 28, 05, 22, 02, 19         | WorkspaceCompaniesList; WorkspaceBilling; WorkspacePayouts; BillingSubtabs; WorkspaceEmpt… |
| workspace-mobile.jsx          | mobile            | 02, 03, 18, 24, 01, 12     | WorkspaceMobileApp; WSMOrders; WSMOrderDetail; WSMChat; WSMTime; WSMInbox; WSMTimer; WSMC… |
| workspace-monitoring.jsx      | workspace         | 21, 07                     | SystemMonitoring (health cards · cron heatmap · notification health · audit feed · error … |
| workspace-notify.jsx          | workspace         | 07, 10, 13                 | WsLoyaltySettings; WsNotifications; NfAnnounce; AnnounceModal; NfDigest; NfThresholds; Nf… |
| workspace-orders-v2.jsx       | workspace         | 02                         | WorkspaceOrders; WorkspaceOrdersList (cross-order filtered registry)                       |
| workspace-p2b.jsx             | workspace         | 12, 20, 01                 | WsTeamCapacity; WsViewAs; AuthFlowsViewer; AuthMagicLink; AuthLinkSent; AuthMustChange; A… |
| workspace-p2c.jsx             | workspace         | 08, 25, 09                 | WsEmailTemplates (email template admin); Wallet top-up + Referral funnel content           |
| workspace-project360-list.jsx | workspace         | 28, 12, 02                 | ProjectsList; ProjectCreateWizard; WsProjects (Projects list + create wizard, opens Proje… |
| workspace-project360.jsx      | workspace         | 28, 05, 22, 02, 12, 06     | Project360Card; PjOverview; PjTeam; PjContract; PjBilling; PjRecurRow; PjRhythm; PjOrders… |
| workspace-reports-v1.jsx      | workspace         | 19, 22                     | WsReportsV1 (5 reports + export + MoM); WsCashFlow (cash-flow forecast); Bars; MarginBar   |
| workspace-reports.jsx         | workspace         | 19, 12, 28                 | ReportsOverview; ReportsExecutors; ReportsClients; ReportsTimesheet; ReportsAudit; Report… |
| workspace-screens.jsx         | workspace         | 02, 12, 05, 28             | WorkspaceDashboard; KanbanBoard; KanbanList; KanbanTimeline; WorkspaceOrderDetail; Worksp… |
| workspace-services.jsx        | workspace         | 27, 05, 07                 | WorkspaceServicesAdmin; WorkspaceBillingServices; NotificationCenter; ToastSystem; Toast   |
| workspace-support-plus.jsx    | workspace         | 29                         | WsCannedReplies; WsKnowledgeBase; KbEditor; PortalHelp; PortalCsat; TicketWithSuggest; Ca… |
| workspace-support.jsx         | workspace         | 29                         | PortalSupport; PortalSupportNew; SupportThread; WorkspaceSupport (support list/queue/thre… |
| workspace-svccatalog.jsx      | workspace         | 27, 05, 22                 | WsServiceCatalog; ServiceEditModal (billable services catalog); SvcCostCell; SvcBillCell   |
| workspace-tasks.jsx           | workspace         | 02, 12, 03, 04, 06         | WorkspaceOrderDetailV2; WorkspaceOrderIntake; FloatingTimerBar; StopTimerModalOverlay; Cl… |
| workspace-testimonials.jsx    | workspace         | 11, 14                     | WsTestimonials; TestimonialModal; LandingTestimonialsPreview; Stars                        |
| workspace-wallet.jsx          | workspace         | 25, 09, 22                 | WalletPortal; WalletAdminCompanies; WalletAdminLedger; WalletAdjustModal; ReferralTiers    |

## Додаток B — реалізовані маршрути коду

### portal (23)

| Шлях                   | Компонент                             | Стан    | Файл                                           |
| ---------------------- | ------------------------------------- | ------- | ---------------------------------------------- |
| /login                 | LoginPage                             | 🟢 IMPL | apps/portal/src/routes/auth/LoginPage.tsx      |
| /register              | RegisterPage                          | 🟢 IMPL | apps/portal/src/routes/auth/RegisterPage.tsx   |
| /forgot-password       | ForgotPasswordPage                    | 🟢 IMPL | apps/portal/src/routes/auth/ForgotPasswordPag… |
| /reset-password        | ResetPasswordPage                     | 🟢 IMPL | apps/portal/src/routes/auth/ResetPasswordPage… |
| /invite/:token         | InviteAcceptPage                      | 🟢 IMPL | apps/portal/src/routes/auth/InviteAcceptPage.… |
| /orders                | OrdersPage                            | 🟢 IMPL | apps/portal/src/routes/orders/OrdersPage.tsx   |
| /orders/new            | Placeholder (title="Нове замовлення") | 🟡 PLHD | apps/portal/src/routes/Placeholder.tsx         |
| /orders/:id            | OrderDetailPage                       | 🟢 IMPL | apps/portal/src/routes/orders/OrderDetailPage… |
| /billing               | BillingPage                           | 🟢 IMPL | apps/portal/src/routes/billing/BillingPage.tsx |
| /wallet                | WalletPage                            | 🟢 IMPL | apps/portal/src/routes/wallet/WalletPage.tsx   |
| /documents             | Placeholder (title="Документи")       | 🟡 PLHD | apps/portal/src/routes/Placeholder.tsx         |
| /loyalty               | LoyaltyPage                           | 🟢 IMPL | apps/portal/src/routes/loyalty/LoyaltyPage.tsx |
| /referrals             | ReferralsPage                         | 🟢 IMPL | apps/portal/src/routes/referrals/ReferralsPag… |
| /team                  | TeamPage                              | 🟢 IMPL | apps/portal/src/routes/team/TeamPage.tsx       |
| /support               | Placeholder (title="Підтримка")       | 🟡 PLHD | apps/portal/src/routes/Placeholder.tsx         |
| /settings              | SettingsPage                          | 🟢 IMPL | apps/portal/src/routes/settings/SettingsPage.… |
| /inbox                 | Placeholder (title="Інбокс")          | 🟡 PLHD | apps/portal/src/routes/Placeholder.tsx         |
| /projects              | Placeholder (title="Проєкти")         | 🟡 PLHD | apps/portal/src/routes/Placeholder.tsx         |
| /company               | Placeholder (title="Моя компанія")    | 🟡 PLHD | apps/portal/src/routes/Placeholder.tsx         |
| /secrets               | Placeholder (title="Секрети")         | 🟡 PLHD | apps/portal/src/routes/Placeholder.tsx         |
| /settings/integrations | Placeholder (title="Інтеграції")      | 🟡 PLHD | apps/portal/src/routes/Placeholder.tsx         |
| /                      | Navigate redirect → /orders           | 🟢 IMPL | apps/portal/src/App.tsx                        |
| \* (catch-all)         | Navigate redirect → /orders           | 🟢 IMPL | apps/portal/src/App.tsx                        |

### workspace (20)

| Шлях                         | Компонент                                                         | Стан    | Файл                                           |
| ---------------------------- | ----------------------------------------------------------------- | ------- | ---------------------------------------------- |
| /login                       | LoginPage                                                         | 🟢 IMPL | apps/workspace/src/routes/auth/LoginPage.tsx   |
| /forgot-password             | ForgotPasswordPage                                                | 🟢 IMPL | apps/workspace/src/routes/auth/ForgotPassword… |
| /reset-password              | ResetPasswordPage                                                 | 🟢 IMPL | apps/workspace/src/routes/auth/ResetPasswordP… |
| /invite/:token               | InviteAcceptPage                                                  | 🟢 IMPL | apps/workspace/src/routes/auth/InviteAcceptPa… |
| /                            | Home → OwnerDashboard (owner/manager) \| DashboardPage (executor) | 🟢 IMPL | apps/workspace/src/App.tsx; apps/workspace/sr… |
| /orders/:id                  | OrderDetailPage                                                   | 🟢 IMPL | apps/workspace/src/routes/orders/OrderDetailP… |
| /profile                     | ProfilePage                                                       | 🟢 IMPL | apps/workspace/src/routes/profile/ProfilePage… |
| /settings (owner-only)       | SettingsPage                                                      | 🟢 IMPL | apps/workspace/src/routes/settings/SettingsPa… |
| /orders (owner+manager)      | OrdersPage                                                        | 🟢 IMPL | apps/workspace/src/routes/orders/OrdersPage.t… |
| /clients (owner+manager)     | ClientsPage                                                       | 🟢 IMPL | apps/workspace/src/routes/clients/ClientsPage… |
| /clients/:id (owner+manager) | ClientDetailPage                                                  | 🟢 IMPL | apps/workspace/src/routes/clients/ClientDetai… |
| /team (owner+manager)        | TeamPage                                                          | 🟢 IMPL | apps/workspace/src/routes/team/TeamPage.tsx    |
| /billing (owner-only)        | BillingPage                                                       | 🟢 IMPL | apps/workspace/src/routes/billing/BillingPage… |
| /projects (owner-only)       | ProjectsPage                                                      | 🟢 IMPL | apps/workspace/src/routes/projects/ProjectsPa… |
| /finance (owner-only)        | FinancePage                                                       | 🟢 IMPL | apps/workspace/src/routes/finance/FinancePage… |
| /margin (owner-only)         | MarginPage                                                        | 🟢 IMPL | apps/workspace/src/routes/margin/MarginPage.t… |
| /payouts (owner-only)        | PayoutsPage                                                       | 🟢 IMPL | apps/workspace/src/routes/payouts/PayoutsPage… |
| /services (owner-only)       | ServicesPage                                                      | 🟢 IMPL | apps/workspace/src/routes/services/ServicesPa… |
| /admin-wallet (owner-only)   | AdminWalletPage                                                   | 🟢 IMPL | apps/workspace/src/routes/adminWallet/AdminWa… |
| \* (catch-all)               | Navigate redirect → /                                             | 🟢 IMPL | apps/workspace/src/App.tsx                     |

### landing (2)

| Шлях              | Компонент                                                 | Стан    | Файл                                     |
| ----------------- | --------------------------------------------------------- | ------- | ---------------------------------------- |
| /                 | HomePage (static skeleton — "Landing skeleton is ready.") | 🟡 PLHD | apps/landing/src/app/page.tsx            |
| /api/health (GET) | health route handler (returns status/uptime/version JSON) | 🟢 IMPL | apps/landing/src/app/api/health/route.ts |
