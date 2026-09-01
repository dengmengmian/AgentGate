import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientLogo, CLIENT_LOGO_IDS } from "./ClientLogo";

describe("ClientLogo", () => {
  it("renders a uniquely labelled mark for every client", () => {
    const { container } = render(
      <div>
        {CLIENT_LOGO_IDS.map((id) => (
          <ClientLogo key={id} id={id} />
        ))}
      </div>
    );

    const labels = CLIENT_LOGO_IDS.map((id) => {
      const img = screen.getByTestId(`client-logo-${id}`);
      expect(img).toBeInTheDocument();
      return img.getAttribute("aria-label");
    });

    expect(new Set(labels).size).toBe(CLIENT_LOGO_IDS.length);
    expect(container.querySelectorAll("svg").length).toBe(
      CLIENT_LOGO_IDS.length
    );
  });
});
