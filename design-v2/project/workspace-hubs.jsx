// workspace-hubs.jsx — consolidate static-tab screens into clickable hubs,
// removing the "only one tab reachable from the sidebar" dead-ends:
//   ReportsHub      (Огляд · Виконавці · Клієнти · Підрозділи · Timesheet · Audit)
//   AdminSettingsHub (Шаблони · SMTP · Брендинг PDF · Номенклатура · Крони)
//   AdminHub        (Підрозділи · Команда·ролі · Permissions · Запрошення)
// Each reuses the existing self-contained screens; their shared rep-tab bar
// drives navigation via a window bridge.

const _hb = React.useState;

function makeHub(stateKey, bridgeName, bodies, def) {
  return function Hub() {
    const [tab, setTab] = _hb(def);
    window[bridgeName] = setTab;
    const Body = window[bodies[tab] || bodies[def]];
    return Body ? React.createElement(Body) : null;
  };
}

const ReportsHub = makeHub('reports', '__reportsNav', {
  overview:    'ReportsOverview',
  executors:   'ReportsExecutors',
  clients:     'ReportsClients',
  departments: 'ReportsDepartments',
  timesheet:   'ReportsTimesheet',
  audit:       'ReportsAudit',
}, 'overview');

const AdminSettingsHub = makeHub('adminset', '__adminSetNav', {
  templates:    'AdminTemplates',
  smtp:         'AdminSmtp',
  branding:     'AdminBranding',
  nomenclature: 'AdminNomenclature',
  crons:        'AdminCrons',
}, 'templates');

const AdminHub = makeHub('admin', '__adminNav', {
  departments: 'AdminDepartments',
  team:        'AdminTeam',
  permissions: 'AdminPermissions',
  invites:     'AdminTeam',
}, 'departments');

// Same admin shell, but the "Команда" sidebar shortcut lands on the team tab.
const AdminTeamHub = makeHub('adminteam', '__adminNav', {
  departments: 'AdminDepartments',
  team:        'AdminTeam',
  permissions: 'AdminPermissions',
  invites:     'AdminTeam',
}, 'team');

// Portal settings: profile · company · members · security · notifications
const PortalSettingsHub = makeHub('portalset', '__portalSetNav', {
  profile:       'PortalSettingsProfile',
  security:      'PortalSettingsSecurity',
  notifications: 'PortalSettingsNotifications',
}, 'profile');

Object.assign(window, { ReportsHub, AdminSettingsHub, AdminHub, AdminTeamHub, PortalSettingsHub });
