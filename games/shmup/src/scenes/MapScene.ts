import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { TUNING } from "../tuning";
import { copy, ratingsTierForScore, ratingsTierName } from "../content";
import { loadCareer } from "../systems/career";
import type { CareerState } from "../systems/career";
import { availableNodeIds, mapLagFor, nodeVisibility } from "../systems/map";
import type { MapNode, NodeType, NodeVisibility, SeasonMap } from "../systems/map";
import { computeDifficulty } from "../systems/difficulty";
import { SCENE_KEYS } from "./sceneData";
import type { EpisodeLaunchData, ResolveLaunchData } from "./sceneData";

const NODE_SIZE = 56;
const BOSS_NODE_SIZE = 76;
const TOP_MARGIN = 150;
const BOTTOM_MARGIN = 110;
const SIDE_MARGIN = 56;

const NODE_COLOR: Record<NodeType, number> = {
  standard: 0xff6b00,
  elite: 0xff3344,
  shop: 0x5599ff,
  event: 0xffcc00,
  treasure: 0x7b3dbe,
  bossFinale: 0xffcc00,
};

const NODE_LABEL_KEY: Record<NodeType, string> = {
  standard: "map.node.standard",
  elite: "map.node.elite",
  shop: "map.node.shop",
  event: "map.node.event",
  treasure: "map.node.treasure",
  bossFinale: "map.node.bossFinale",
};

const COMBAT_TYPES: readonly NodeType[] = ["standard", "elite", "bossFinale"];

/**
 * The Season node-map (FTL/StS style, run-structure.spec.todo.md, F8 #136).
 * Read-only against the persisted career — every mutation (node resolution,
 * season/Syndication transitions) happens in ResolveScene, so this scene can
 * always be rebuilt fresh from `loadCareer()` with no local state to lose on
 * a reload (root CLAUDE.md's reload-mid-map rule: a reload here just shows
 * the same map again).
 */
export class MapScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.map);
  }

  create() {
    const career = loadCareer();
    if (career.phase === "syndication") {
      this.renderSyndication(career);
    } else {
      this.renderSeasonMap(career);
    }
  }

  private renderSeasonMap(career: CareerState): void {
    const map = career.seasonMap;
    const available = new Set(availableNodeIds(map, career.currentNodeId));
    const visibility = nodeVisibility(map, career.currentNodeId, career.visitedNodeIds);
    const visited = new Set(career.visitedNodeIds);
    const positions = this.layoutPositions(map);

    this.add
      .text(GAME_WIDTH / 2, 20, copy("map.title", { season: career.season }), {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 52, this.ratingsLine(career), {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffcc00",
      })
      .setOrigin(0.5, 0);

    this.drawDeadline(career, map);
    this.drawEdges(map, positions, available);

    for (const node of Object.values(map.nodes)) {
      this.drawNode(node, positions[node.id], {
        visibility: visibility[node.id],
        isAvailable: available.has(node.id),
        isVisited: visited.has(node.id),
        isCurrent: node.id === career.currentNodeId,
        career,
      });
    }

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 20, copy("map.hint"), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#888888",
      })
      .setOrigin(0.5, 1);
  }

  private renderSyndication(career: CareerState): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, copy("map.syndication.title"), {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#ffcc00",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.38, copy("syndication.flavor"), {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.46, copy("map.syndication.episode", { episode: career.syndicationEpisodeIndex + 1 }), {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.52, this.ratingsLine(career), {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffcc00",
      })
      .setOrigin(0.5);

    if (career.finaleScore !== null) {
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.57, copy("resolve.finaleScore", { score: Math.round(career.finaleScore) }), {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#888888",
        })
        .setOrigin(0.5);
    }

    const button = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.68, 260, 64, 0xff6b00)
      .setStrokeStyle(3, 0xffcc88)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.68, copy("play.continuePrompt"), {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 220 },
      })
      .setOrigin(0.5);

    const launch = () => {
      const D = computeDifficulty({
        season: TUNING.difficulty.seasonCount,
        episodeIndex: career.syndicationEpisodeIndex,
        mapLag: 0,
      });
      const data: EpisodeLaunchData = {
        nodeId: `syndication-${career.syndicationEpisodeIndex}`,
        nodeType: "standard",
        season: TUNING.difficulty.seasonCount,
        D,
        ratings: career.ratings,
        weapons: career.weapons,
        isSeriesFinale: false,
      };
      this.scene.start(SCENE_KEYS.play, data);
    };
    button.on("pointerdown", launch);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 20, copy("map.syndication.hint"), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#888888",
      })
      .setOrigin(0.5, 1);
  }

  /** Column 0 sits near the bottom of the (portrait) screen, the boss column near the top — the deadline creeps upward as it advances. */
  private layoutPositions(map: SeasonMap): Record<string, { x: number; y: number }> {
    const bandCount = map.columns + 1;
    const usableHeight = GAME_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;
    const bandHeight = usableHeight / bandCount;
    const yForCol = (col: number) => GAME_HEIGHT - BOTTOM_MARGIN - col * bandHeight;

    const byColumn = new Map<number, MapNode[]>();
    for (const node of Object.values(map.nodes)) {
      const list = byColumn.get(node.col) ?? [];
      list.push(node);
      byColumn.set(node.col, list);
    }

    const usableWidth = GAME_WIDTH - SIDE_MARGIN * 2;
    const positions: Record<string, { x: number; y: number }> = {};
    for (const [col, nodes] of byColumn) {
      nodes.sort((a, b) => a.row - b.row);
      const y = yForCol(col);
      nodes.forEach((node, i) => {
        const x = nodes.length === 1 ? GAME_WIDTH / 2 : SIDE_MARGIN + (usableWidth * i) / (nodes.length - 1);
        positions[node.id] = { x, y };
      });
    }
    return positions;
  }

  private drawDeadline(career: CareerState, map: SeasonMap): void {
    const bandCount = map.columns + 1;
    const usableHeight = GAME_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;
    const bandHeight = usableHeight / bandCount;
    const yForCol = (col: number) => GAME_HEIGHT - BOTTOM_MARGIN - col * bandHeight;
    const y = Phaser.Math.Clamp(yForCol(career.deadlinePosition), TOP_MARGIN, GAME_HEIGHT - BOTTOM_MARGIN);

    const g = this.add.graphics();
    g.lineStyle(2, 0xff3344, 0.8);
    g.strokeLineShape(new Phaser.Geom.Line(SIDE_MARGIN - 20, y, GAME_WIDTH - SIDE_MARGIN + 20, y));

    // Any node column is at risk once the deadline has passed column 0.
    if (mapLagFor(career.deadlinePosition, 0) > 0) {
      this.add
        .text(GAME_WIDTH / 2, y - 14, copy("map.deadlineWarning"), {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#ff3344",
        })
        .setOrigin(0.5, 1);
    }
  }

  private drawEdges(map: SeasonMap, positions: Record<string, { x: number; y: number }>, available: Set<string>): void {
    const g = this.add.graphics();
    for (const node of Object.values(map.nodes)) {
      const from = positions[node.id];
      for (const nextId of node.next) {
        const to = positions[nextId];
        if (!to) continue;
        const highlighted = available.has(node.id) || available.has(nextId);
        g.lineStyle(highlighted ? 2 : 1, highlighted ? 0xffcc88 : 0x555555, highlighted ? 0.9 : 0.4);
        g.strokeLineShape(new Phaser.Geom.Line(from.x, from.y, to.x, to.y));
      }
    }
  }

  private drawNode(
    node: MapNode,
    pos: { x: number; y: number },
    opts: { visibility: NodeVisibility; isAvailable: boolean; isVisited: boolean; isCurrent: boolean; career: CareerState }
  ): void {
    const isBoss = node.type === "bossFinale";
    const size = isBoss ? BOSS_NODE_SIZE : NODE_SIZE;

    if (opts.visibility === "hidden") {
      this.add.rectangle(pos.x, pos.y, size * 0.6, size * 0.6, 0x333333).setStrokeStyle(1, 0x555555);
      this.add
        .text(pos.x, pos.y, copy("map.node.fogged"), { fontFamily: "monospace", fontSize: "14px", color: "#777777" })
        .setOrigin(0.5);
      return;
    }

    if (opts.visibility === "partial") {
      const combatLike = COMBAT_TYPES.includes(node.type);
      const color = combatLike ? 0x664422 : 0x442266;
      this.add.rectangle(pos.x, pos.y, size * 0.8, size * 0.8, color).setStrokeStyle(1, 0x888888);
      return;
    }

    const color = NODE_COLOR[node.type];
    const rect = this.add
      .rectangle(pos.x, pos.y, size, size, color, opts.isVisited ? 0.35 : 1)
      .setStrokeStyle(opts.isCurrent ? 4 : 2, opts.isCurrent ? 0xffffff : 0x000000);

    const isSeriesFinale = isBoss && opts.career.season >= TUNING.difficulty.seasonCount;
    const labelKey = isSeriesFinale ? "map.node.seriesFinale" : NODE_LABEL_KEY[node.type];
    this.add
      .text(pos.x, pos.y - (isBoss ? 8 : 4), copy(labelKey), {
        fontFamily: "monospace",
        fontSize: isBoss ? "9px" : "8px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: size - 6 },
      })
      .setOrigin(0.5);

    if (COMBAT_TYPES.includes(node.type)) {
      const D = computeDifficulty({
        season: opts.career.season,
        episodeIndex: opts.career.visitedNodeIds.length,
        stageOffset: node.difficultyOffset,
        mapLag: mapLagFor(opts.career.deadlinePosition, node.col),
      });
      this.add
        .text(pos.x, pos.y + (isBoss ? 14 : 10), `D${Math.round(D)}`, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#ffe8cc",
        })
        .setOrigin(0.5);
    }

    if (opts.isVisited) {
      this.add.text(pos.x + size / 2 - 4, pos.y - size / 2 + 2, "OK", { fontFamily: "monospace", fontSize: "7px", color: "#88ff88" }).setOrigin(1, 0);
    }

    if (!opts.isAvailable) return;

    rect.setInteractive({ useHandCursor: true });
    rect.on("pointerdown", () => this.selectNode(node, opts.career));
  }

  private selectNode(node: MapNode, career: CareerState): void {
    if (COMBAT_TYPES.includes(node.type)) {
      const D = computeDifficulty({
        season: career.season,
        episodeIndex: career.visitedNodeIds.length,
        stageOffset: node.difficultyOffset,
        mapLag: mapLagFor(career.deadlinePosition, node.col),
      });
      const isSeriesFinale = node.type === "bossFinale" && career.season >= TUNING.difficulty.seasonCount;
      const data: EpisodeLaunchData = {
        nodeId: node.id,
        nodeType: node.type as EpisodeLaunchData["nodeType"],
        season: career.season,
        D,
        ratings: career.ratings,
        weapons: career.weapons,
        isSeriesFinale,
      };
      this.scene.start(SCENE_KEYS.play, data);
      return;
    }

    // Special nodes (shop/event/treasure) resolve instantly — no episode to fly.
    const bonus =
      node.type === "shop"
        ? TUNING.map.shopRatingsBonus
        : node.type === "event"
          ? TUNING.map.eventRatingsBonus
          : TUNING.map.treasureRatingsBonus;
    const data: ResolveLaunchData = {
      outcome: "special",
      nodeId: node.id,
      nodeType: node.type,
      season: career.season,
      isSeriesFinale: false,
      score: 0,
      ratingsBefore: career.ratings,
      ratingsDelta: bonus,
    };
    this.scene.start(SCENE_KEYS.resolve, data);
  }

  private ratingsLine(career: CareerState): string {
    return copy("resolve.ratingsLine", {
      ratings: Math.round(career.ratings),
      tier: ratingsTierName(ratingsTierForScore(career.ratings)),
    });
  }
}
