-- S5.6 MOD-4 — роль `manager` (20-А, ADR-008 §Доступ). ADDITIVE enum value.
-- manager: бачить замовлення/чати/клієнтів — finance/settings НІ. Фіксований набір
-- (owner/manager/executor), без custom-RBAC (той — SaaS Phase 1). Enforcement у can()-шимі.
-- ALTER TYPE ADD VALUE не можна в транзакції — без BEGIN/COMMIT.

ALTER TYPE "AgencyMemberRole" ADD VALUE 'manager';
