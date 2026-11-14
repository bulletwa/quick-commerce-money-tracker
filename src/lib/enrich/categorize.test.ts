import { describe, expect, it } from "vitest";
import { categorize, normalizeName } from "./categorize";

describe("categorize", () => {
  const g = (n: string) => categorize(n, "grocery");
  const f = (n: string) => categorize(n, "food");
  it("keeps dishes and store items apart", () => {
    expect(f("Chicken Biryani")).toBe("Biryani & Rice");
    expect(g("Licious Chicken Curry Cut")).toBe("Meat & Seafood");
    expect(f("Paneer Butter Masala")).toBe("Indian Mains");
    expect(g("Amul Fresh Malai Paneer")).toBe("Dairy & Eggs");
    expect(g("Tops Plain Hakka Noodles")).toBe("Pasta & Instant Food");
    expect(f("Veg Hakka Noodles")).toBe("Chinese & Asian");
  });
  it("uses word boundaries (no more steak=tea, watermelon=water)", () => {
    expect(f("Chicken Steak")).not.toBe("Beverages");
    expect(g("Watermelon")).toBe("Fruits & Vegetables");
    expect(g("Eggplant")).not.toBe("Dairy & Eggs");
  });
  it("covers the long tail seen in real orders", () => {
    expect(g("The Derma Co 1% Salicylic Acid Face Wash")).toBe("Personal Care & Beauty");
    expect(g("Honitus Cough Syrup")).toBe("Health & Pharmacy");
    expect(g("Havells Extension Cable (2 m, White-Blue)")).toBe("Electronics & Appliances");
    expect(g("Good Knight Flash Liquid Vaporiser")).toBe("Cleaning & Household");
    expect(g("Safal Frozen Green Peas")).toBe("Frozen Food");
    expect(g("Marlboro Gold Advance")).toBe("Tobacco");
    expect(g("Kinder Joy (Pink)")).toBe("Sweets & Chocolates");
    expect(g("Mirinda Soft Drink (2.25 l)")).toBe("Beverages");
    expect(g("Ching's Secret Schezwan Chutney, Spread")).toBe("Sauces & Spices");
    expect(g("Button Mushroom")).toBe("Fruits & Vegetables");
    expect(g("Motomax Chain Lubricant Spray")).toBe("Hardware & Tools");
    expect(g("Mangaldeep Incense Sticks / Agarbatti")).toBe("Puja & Festive");
  });
});

describe("normalizeName", () => {
  it("merges size and wording variants", () => {
    expect(normalizeName("Safal Frozen Green Peas 1 Kg")).toBe(normalizeName("Safal Frozen Green Peas"));
    expect(normalizeName("Amul Taaza Toned Fresh Milk")).toBe("Amul Taaza Toned Milk");
    expect(normalizeName("7UP Nimbooz - Pack of 6")).toBe("7UP Nimbooz");
    expect(normalizeName("Amul Taaza Toned Milk Pouch")).toBe(normalizeName("Amul Taaza Toned Milk"));
    expect(normalizeName("Marlboro Gold Advance Cigarettes")).toBe(normalizeName("Marlboro Gold Advance"));
  });
});

describe("categorize regressions from a real audit", () => {
  const g = (n: string) => categorize(n, "grocery");
  it("separates look-alikes", () => {
    expect(g("Classic Ice Burst")).toBe("Tobacco");
    expect(g("Classic Double Burst")).toBe("Tobacco");
    // restaurant dishes are never tobacco ("Burst" is a pizza/burger word)
    expect(categorize("Veg Makhani Burst Burger", "food")).not.toBe("Tobacco");
    expect(categorize("Kheema and Sausages Cheese Burst Pizza [Medium]", "food")).not.toBe("Tobacco");
    expect(g("Flair Hotline Fineliner Highlighter Pen")).not.toBe("Tobacco");
    expect(g("Wonderchef Stainless Steel Gas Lighter")).not.toBe("Tobacco");
    expect(g("Freecultr All-Day Boxers (Orange)")).toBe("Apparel & Accessories");
    expect(g("SUGAR Matte As Hell Bold Lipstick")).toBe("Personal Care & Beauty");
    expect(g("Fortune Kachi Ghani Pure Mustard Oil")).toBe("Staples");
    expect(g("Nescafe Classic Instant Coffee Powder")).toBe("Beverages");
    expect(g("Xech Cordless Vacuum Cleaner")).toBe("Electronics & Appliances");
    expect(g("Wai Wai Ready To Eat Chicken Flavoured Noodles")).toBe("Pasta & Instant Food");
  });
});

import { normalizeName as nn } from "./categorize";
it("drops stray trailing pipes", () => expect(nn("Amul Taaza Toned Milk | 500 ml")).toBe("Amul Taaza Toned Milk"));
