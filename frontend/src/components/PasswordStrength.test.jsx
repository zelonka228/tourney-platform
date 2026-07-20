import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "../lib/i18n";
import { PasswordStrength } from "./PasswordStrength";

function renderWithI18n(ui) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("<PasswordStrength />", () => {
  it("renders nothing extra for an empty password (just the 4 empty bars)", () => {
    renderWithI18n(<PasswordStrength password="" />);
    expect(screen.getByTestId("password-strength")).toBeInTheDocument();
    // No strength label or hint text should show for an empty password.
    expect(screen.queryByText(/weak|medium|strong|слабк|середн|надійн|слаб|средн|надёжн/i)).toBeNull();
  });

  it("shows a strength label once a password is typed", () => {
    renderWithI18n(<PasswordStrength password="VeryLongPassword123!" />);
    const container = screen.getByTestId("password-strength");
    expect(container.textContent.length).toBeGreaterThan(0);
  });
});
