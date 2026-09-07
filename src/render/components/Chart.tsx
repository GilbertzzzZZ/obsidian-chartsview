import React, { useEffect, useMemo, useRef } from "react";
import * as Plots from "@ant-design/plots";
import { PlotErrorBoundary } from "./PlotErrorBoundary";

export interface ConfigProps {
	onReady?: (instance: unknown) => void;
	interaction?: Record<string, unknown> & {
		tooltip?: Record<string, unknown>;
	};
	[key: string]: unknown;
}

interface TooltipContent {
	title?: unknown;
	items: { name?: unknown; value?: unknown; color?: string }[];
}

function buildTooltipContent({ title, items }: TooltipContent): HTMLElement {
	const root = document.createElement("div");
	if (title !== undefined && title !== null && title !== "") {
		const heading = document.createElement("div");
		heading.className = "g2-tooltip-title";
		heading.textContent = String(title);
		root.appendChild(heading);
	}
	const list = document.createElement("ul");
	list.className = "g2-tooltip-list";
	for (const item of items) {
		const row = document.createElement("li");
		row.className = "g2-tooltip-list-item";
		const name = document.createElement("span");
		name.className = "g2-tooltip-list-item-name";
		const marker = document.createElement("span");
		marker.className = "g2-tooltip-list-item-marker";
		marker.style.backgroundColor = item.color ?? "black";
		const label = document.createElement("span");
		label.className = "g2-tooltip-list-item-name-label";
		label.textContent = String(item.name ?? "");
		label.title = label.textContent;
		const value = document.createElement("span");
		value.className = "g2-tooltip-list-item-value";
		value.textContent = String(item.value ?? "");
		value.title = value.textContent;
		name.appendChild(marker);
		name.appendChild(label);
		row.appendChild(name);
		row.appendChild(value);
		list.appendChild(row);
	}
	root.appendChild(list);
	return root;
}

function renderTooltipContent(_event: unknown, content: TooltipContent): HTMLElement {
	return buildTooltipContent(content);
}

export interface ChartProps {
	type: string;
	config: ConfigProps;
	// 图表实例的出口。导出 PNG 的按钮和粒度按钮同属图注头部的一组控件，由
	// ChartFigure 渲染，所以实例要交到它手里。
	onInstance?: (instance: PlotInstance | null) => void;
	// 渲染崩溃时的错误框。上下文（文件、行号、原文）只有 ChartFigure 握着，所以
	// 错误框由它渲染，边界只负责把消息交回去。
	renderError?: (message: string) => React.ReactNode;
}

// AntV 图表实例：出图组件依赖导出 PNG，以及 chart 上的两个尺寸相关能力
// （见下方 attachSizeGuard 的说明）。
export interface PlotInstance {
	downloadImage?: (name: string) => void;
	chart?: {
		forceFit?: () => unknown;
		getContainer?: () => HTMLElement | null | undefined;
	};
}

const PLOT_COMPONENTS = Plots as unknown as Record<
	string,
	React.ComponentType<ConfigProps>
>;

export const Chart = ({ type, config, onInstance, renderError }: ChartProps) => {
	const PlotComponent = PLOT_COMPONENTS[type];
	const sizeGuardRef = useRef<ResizeObserver | null>(null);
	const { onReady } = config ?? {};
	const plotConfig = useMemo(
		() => ({
			...config,
			interaction: {
				...config.interaction,
				tooltip: {
					...config.interaction?.tooltip,
					render: renderTooltipContent,
				},
			},
		}),
		[config],
	);

	// 尺寸不变量：画布尺寸必须等于容器尺寸。
	// G2 的 sizeOf() 在 autoFit 下量容器，量到 0 就退回 640×480 默认画布；一个被
	// 阅读视图虚拟化摘离（或 display:none）的宿主正好量出 0。于是任何一次落在这个
	// 窗口里的渲染——主题切换重建、宽度重建、粒度切换——都会把画布改成 640 宽并
	// 一直留着。G2 自己救不回来：它的 autoFit 只在 window resize 时重新量
	// （runtime 的 _bindAutoFit 只 addEventListener('resize')），容器自身的尺寸
	// 变化它一无所知。
	// 这里直接盯住图表自己的容器：一旦它重新拿到布局盒就让 G2 重新量一次。
	// forceFit() 在尺寸未变时提前返回，不会触发多余渲染，因此每次回调都调是安全的；
	// 它也只改画布几何、不碰配置对象，不会踩到"配置对象被渲染第二次"那个坑。
	const attachSizeGuard = (instance: PlotInstance | null) => {
		sizeGuardRef.current?.disconnect();
		sizeGuardRef.current = null;
		const chart = instance?.chart;
		const host = chart?.getContainer?.();
		if (!chart?.forceFit || !host) return;
		const observer = new ResizeObserver(() => {
			// 没有布局盒时不量，否则等于亲手把好画布改成 640×480。
			if (!host.isConnected || host.clientWidth === 0) return;
			chart.forceFit?.();
		});
		observer.observe(host);
		sizeGuardRef.current = observer;
	};

	useEffect(
		() => () => {
			sizeGuardRef.current?.disconnect();
			sizeGuardRef.current = null;
			// 卸载时收回实例：导出按钮拿着的引用不能指向一张已经拆掉的图。
			onInstance?.(null);
		},
		[],
	);

	return (
		<PlotErrorBoundary fallback={renderError}>
			<PlotComponent
				{...plotConfig}
				onReady={(instance: unknown) => {
					onReady?.(instance);
					attachSizeGuard(instance as PlotInstance);
					onInstance?.(instance as PlotInstance);
				}}
			/>
		</PlotErrorBoundary>
	);
};
