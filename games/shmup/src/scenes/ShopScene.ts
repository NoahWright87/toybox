import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { TUNING } from "../tuning";
import { ALL_ITEMS, ALL_WEAPONS, copy, itemById, ratingsTierForScore, ratingsTierRank, weaponById } from "../content";
import { loadCareer, saveCareer } from "../systems/career";
import type { CareerState, OwnedItemRef } from "../systems/career";
import {
  generateShopStock,
  interestEarned,
  nextRerollCost,
  ownedBrandCounts,
  rarityRank,
  statPickMods,
} from "../systems/economy";
import type { ShopStockEntry } from "../systems/economy";
import { MAX_WEAPON_SLOTS, resolveLoadout, weaponUpgradeCost } from "../systems/effects";
import type { OwnedItem, OwnedWeapon } from "../systems/effects";
import { SCENE_KEYS } from "./sceneData";
import type { ShopLaunchData } from "./sceneData";

// Sized so the worst case (6 owned weapons + a 5-slot dedicated shop node)
// still clears the footer (reroll/leave) without overlapping it.
const ROW_HEIGHT = 64;

/**
 * Shop (economy.spec.todo.md, F9 #137): the "baseline" variant is the small
 * shop shown at every inter-level break; the "node" variant is a dedicated
 * map shop node with bigger stock (both cadences share this scene and the
 * offer-weighting engine — only slot count differs, see `TUNING.economy`).
 * Interest is applied exactly once per visit, right here on entry (the
 * spec's "unspent gold earns interest each inter-level shop") — every other
 * mutation (buy/upgrade/reroll) re-renders in place rather than restarting
 * the scene, so interest is never double-applied.
 */
export class ShopScene extends Phaser.Scene {
  private launch!: ShopLaunchData;
  private career!: CareerState;
  private ratingsRank = 0;
  private interestGained = 0;
  private rerollsUsedThisVisit = 0;
  private stock: ShopStockEntry[] = [];
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private goldText!: Phaser.GameObjects.Text;
  private rerollText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.shop);
  }

  init(data: ShopLaunchData) {
    this.launch = data;
  }

  create() {
    this.career = loadCareer();
    this.ratingsRank = ratingsTierRank(ratingsTierForScore(this.career.ratings));
    this.rerollsUsedThisVisit = 0;

    const creditScore = this.resolvedStats(this.career).creditScore;
    this.interestGained = interestEarned(this.career.gold, creditScore);
    this.career = { ...this.career, gold: this.career.gold + this.interestGained };
    this.saveAndPersist();

    this.stock = this.rollStock();

    this.add
      .text(GAME_WIDTH / 2, 60, copy(this.launch.variant === "node" ? "shop.title.node" : "shop.title.baseline"), {
        fontFamily: "monospace",
        fontSize: "26px",
        color: "#ffcc00",
      })
      .setOrigin(0.5);

    this.goldText = this.add
      .text(GAME_WIDTH / 2, 100, "", { fontFamily: "monospace", fontSize: "16px", color: "#ffcc88" })
      .setOrigin(0.5);

    if (this.interestGained > 0) {
      this.add
        .text(GAME_WIDTH / 2, 122, copy("shop.interestEarned", { gold: Math.round(this.interestGained) }), {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#88ff88",
        })
        .setOrigin(0.5);
    }

    this.statusText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 96, "", { fontFamily: "monospace", fontSize: "12px", color: "#ff6666" })
      .setOrigin(0.5);

    this.rerollText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 140, "", { fontFamily: "monospace", fontSize: "13px", color: "#7b3dbe" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.rerollText.on("pointerdown", () => this.reroll());

    const leave = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 50, 220, 50, 0xff6b00)
      .setStrokeStyle(3, 0xffcc88)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 50, copy("shop.leave"), {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    leave.on("pointerdown", () => this.scene.start(SCENE_KEYS.map));

    this.renderRows();
  }

  private ownedWeapons(career: CareerState): OwnedWeapon[] {
    return career.weapons.map((ref) => ({ weapon: weaponById(ref.weaponId), tier: ref.tier }));
  }

  private ownedItems(career: CareerState): OwnedItem[] {
    return career.items
      .map((ref) => {
        const item = itemById(ref.itemId);
        return item ? { item, count: ref.count } : undefined;
      })
      .filter((owned): owned is OwnedItem => owned !== undefined);
  }

  private resolvedStats(career: CareerState) {
    return resolveLoadout({
      weapons: this.ownedWeapons(career),
      items: this.ownedItems(career),
      chassisMods: statPickMods(career.statPicks),
    }).stats;
  }

  private rollStock(): ShopStockEntry[] {
    const ownedWeapons = this.ownedWeapons(this.career);
    const ownedItems = this.ownedItems(this.career);
    const slotCount = this.launch.variant === "node" ? TUNING.economy.shopNodeSlots : TUNING.economy.shopBaselineSlots;
    return generateShopStock({
      weaponPool: ALL_WEAPONS,
      itemPool: ALL_ITEMS,
      ownedWeapons,
      ownedItems,
      slotCount,
      ctx: {
        luck: this.resolvedStats(this.career).luck,
        D: 0,
        ratingsRank: this.ratingsRank,
        ownedBrandCounts: ownedBrandCounts(ownedWeapons, ownedItems),
      },
    });
  }

  private saveAndPersist(): void {
    saveCareer(this.career);
  }

  private priceFor(entry: ShopStockEntry): number {
    if (entry.kind === "weapon" && entry.weapon) {
      const brand = entry.weapon.brand;
      const counts = ownedBrandCounts(this.ownedWeapons(this.career), this.ownedItems(this.career));
      return weaponUpgradeCost(0, brand ? (counts[brand] ?? 0) : 0);
    }
    if (entry.kind === "item" && entry.item) {
      const tier = entry.item.tier ?? "common";
      return TUNING.economy.itemPriceByTier[rarityRank(tier)];
    }
    return 0;
  }

  private renderRows(): void {
    for (const obj of this.rowObjects) obj.destroy();
    this.rowObjects = [];

    const afterWeapons = this.renderWeaponsSection(170);
    this.renderStockSection(afterWeapons);

    this.refreshHeader();
  }

  private renderWeaponsSection(startY: number): number {
    let y = startY;
    this.rowObjects.push(this.sectionLabel(y, "YOUR WEAPONS"));
    y += 26;

    this.career.weapons.forEach((ref, index) => {
      const weapon = weaponById(ref.weaponId);
      const brandCount = weapon.brand ? (ownedBrandCounts(this.ownedWeapons(this.career), this.ownedItems(this.career))[weapon.brand] ?? 0) : 0;
      const cost = weaponUpgradeCost(ref.tier, brandCount);
      this.rowObjects.push(
        ...this.row(y, `${weapon.name}  (Tier ${ref.tier})`, weapon.brand, copy("shop.upgrade", { cost: Math.round(cost) }), () =>
          this.upgradeWeapon(index, cost)
        )
      );
      y += ROW_HEIGHT;
    });

    return y + 16;
  }

  private renderStockSection(startY: number): number {
    let y = startY;
    this.rowObjects.push(this.sectionLabel(y, "STOCK"));
    y += 26;

    if (this.stock.length === 0) {
      const empty = this.add
        .text(GAME_WIDTH / 2, y, copy("shop.empty"), { fontFamily: "monospace", fontSize: "12px", color: "#888888" })
        .setOrigin(0.5);
      this.rowObjects.push(empty);
      return y + 30;
    }

    for (const entry of this.stock) {
      const name = entry.kind === "weapon" ? entry.weapon?.name : entry.item?.name;
      const brand = entry.kind === "weapon" ? entry.weapon?.brand : entry.item?.brand;
      const tier = entry.kind === "weapon" ? entry.weapon?.tier : entry.item?.tier;
      const cost = this.priceFor(entry);
      const weaponSlotsFull = entry.kind === "weapon" && this.career.weapons.length >= MAX_WEAPON_SLOTS;
      const itemAtCap =
        entry.kind === "item" &&
        entry.item?.maxStacks !== undefined &&
        (this.career.items.find((ref) => ref.itemId === entry.item!.id)?.count ?? 0) >= entry.item.maxStacks;
      const disabled = weaponSlotsFull || itemAtCap;
      const label = weaponSlotsFull
        ? copy("shop.slotsFull")
        : itemAtCap
          ? copy("shop.atCap")
          : copy("shop.buy", { cost: Math.round(cost) });

      this.rowObjects.push(
        ...this.row(y, `${name ?? "?"}  [${(tier ?? "common").toUpperCase()}]`, brand, label, () => this.buy(entry, cost), disabled)
      );
      y += ROW_HEIGHT;
    }
    return y;
  }

  private sectionLabel(y: number, text: string): Phaser.GameObjects.Text {
    return this.add
      .text(GAME_WIDTH / 2, y, text, { fontFamily: "monospace", fontSize: "13px", color: "#ff6b00" })
      .setOrigin(0.5);
  }

  /** One shop row: name/tier + brand tagline (if any) on the left, an action button on the right. Returns the created objects so the caller can track them for cleanup. */
  private row(
    y: number,
    title: string,
    brand: string | undefined,
    actionLabel: string,
    onAction: () => void,
    disabled = false
  ): Phaser.GameObjects.GameObject[] {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const box = this.add
      .rectangle(GAME_WIDTH / 2, y + ROW_HEIGHT / 2 - 10, GAME_WIDTH - 48, ROW_HEIGHT - 12, 0x2a1000)
      .setStrokeStyle(2, 0x664400);
    objs.push(box);

    const titleText = this.add.text(40, y, title, { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" });
    objs.push(titleText);

    if (brand) {
      const brandText = this.add.text(40, y + 20, brand.toUpperCase(), {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#aa88ff",
      });
      objs.push(brandText);
    }

    const button = this.add
      .rectangle(GAME_WIDTH - 90, y + 22, 130, 36, disabled ? 0x333333 : 0xcc4400)
      .setStrokeStyle(2, disabled ? 0x555555 : 0xffcc88);
    const buttonLabel = this.add
      .text(GAME_WIDTH - 90, y + 22, actionLabel, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: disabled ? "#888888" : "#ffffff",
        align: "center",
        wordWrap: { width: 120 },
      })
      .setOrigin(0.5);
    objs.push(button, buttonLabel);

    if (!disabled) {
      button.setInteractive({ useHandCursor: true });
      button.on("pointerdown", onAction);
    }

    return objs;
  }

  private refreshHeader(): void {
    this.goldText.setText(copy("shop.gold", { gold: Math.round(this.career.gold) }));
    const cost = nextRerollCost(this.rerollsUsedThisVisit, this.ratingsRank);
    this.rerollText.setText(cost <= 0 ? copy("reroll.free") : copy("reroll.cost", { cost: Math.round(cost) }));
  }

  private canAfford(cost: number): boolean {
    if (this.career.gold >= cost) return true;
    this.statusText.setText(copy("shop.cantAfford"));
    return false;
  }

  private upgradeWeapon(index: number, cost: number): void {
    if (!this.canAfford(cost)) return;
    const weapons = this.career.weapons.map((ref, i) => (i === index ? { ...ref, tier: ref.tier + 1 } : ref));
    this.career = { ...this.career, gold: this.career.gold - cost, weapons };
    this.statusText.setText("");
    this.saveAndPersist();
    this.renderRows();
  }

  private buy(entry: ShopStockEntry, cost: number): void {
    if (!this.canAfford(cost)) return;

    if (entry.kind === "weapon" && entry.weapon) {
      if (this.career.weapons.length >= MAX_WEAPON_SLOTS) return;
      this.career = {
        ...this.career,
        gold: this.career.gold - cost,
        weapons: [...this.career.weapons, { weaponId: entry.weapon.id, tier: 0 }],
      };
    } else if (entry.kind === "item" && entry.item) {
      const items: OwnedItemRef[] = [...this.career.items];
      const existing = items.findIndex((ref) => ref.itemId === entry.item!.id);
      if (existing >= 0) {
        items[existing] = { ...items[existing], count: items[existing].count + 1 };
      } else {
        items.push({ itemId: entry.item.id, count: 1 });
      }
      this.career = { ...this.career, gold: this.career.gold - cost, items };
    } else {
      return;
    }

    this.statusText.setText("");
    this.saveAndPersist();
    // Re-roll the stock's owned-derived fields (slots-full/at-cap gating) by
    // just re-rendering — the stock list itself persists across a purchase
    // within one visit; buying doesn't consume the offer.
    this.renderRows();
  }

  private reroll(): void {
    const cost = nextRerollCost(this.rerollsUsedThisVisit, this.ratingsRank);
    if (!this.canAfford(cost)) return;
    this.career = { ...this.career, gold: this.career.gold - cost };
    this.rerollsUsedThisVisit += 1;
    this.statusText.setText("");
    this.saveAndPersist();
    this.stock = this.rollStock();
    this.renderRows();
  }
}
