import type { DiagramResult } from "@/lib/contracts";
import type { Locale } from "@/lib/i18n-shared";
import generatedDemoResult from "@/lib/demo-pump.generated.json";

export const demoResult = generatedDemoResult as DiagramResult;

export const demoSubject = {
  en: "Inside a centrifugal pump",
  "zh-CN": "离心泵内部结构",
} satisfies Record<Locale, string>;

const chineseParts: Record<string, { name: string; description: string; evidence: string }> = {
  casing: {
    name: "泵壳",
    description: "包围叶轮并形成蜗壳，将流体速度转化为压力。",
    evidence: "青绿色铸造泵体围绕叶轮形成清晰剖面，可见螺旋形蜗室和底部安装支脚。",
  },
  impeller: {
    name: "叶轮",
    description: "随主轴旋转，通过弯曲叶片将机械能传递给流体。",
    evidence: "泵壳剖面中清楚露出一个带多片弯曲叶片的大型青铜色轮体。",
  },
  shaft: {
    name: "主轴",
    description: "将驱动扭矩传递给叶轮，并保持其旋转轴线。",
    evidence: "银色圆柱构件沿水平旋转轴线可见，包括穿过轴承并伸向右侧的部分。",
  },
  seal: {
    name: "机械密封",
    description: "限制旋转主轴穿出泵壳位置的流体泄漏。",
    evidence: "泵壳右侧紧邻位置可见多层同心密封环围绕主轴排列。",
  },
  inlet: {
    name: "入口",
    description: "引导流体沿轴向进入叶轮的低压中心。",
    evidence: "左侧可见带螺栓的圆形法兰和通向叶轮中心的开放轴向流道。",
  },
  outlet: {
    name: "出口",
    description: "将加压流体从泵壳导入排出管路。",
    evidence: "泵壳上方可见一个向上的大型螺栓法兰和与之连接的垂直颈部。",
  },
  bearing: {
    name: "轴承",
    description: "支撑主轴、限制径向移动并降低旋转摩擦。",
    evidence: "右侧壳体剖面中清楚露出滚珠和同心轴承滚道。",
  },
};

export function localizedDemoResult(locale: Locale): DiagramResult {
  if (locale === "en") return demoResult;

  return {
    ...demoResult,
    annotation: {
      ...demoResult.annotation,
      title: "单级端吸离心泵剖视图",
      summary: "剖视图展示了青绿色蜗壳内的青铜色叶轮，主轴向右穿过密封组件并进入滚珠轴承支撑壳体；吸入口朝左，排出口位于上方。",
      parts: demoResult.annotation.parts.map((part) => ({
        ...part,
        ...(chineseParts[part.id] ?? {}),
      })),
      warnings: [
        "泵壳边界框包含连续的排出颈部和底部安装支脚，因此与单独标出的出口区域有所重叠。",
        "机械密封依据可见的同心环组定位，剖面中无法进一步区分其内部密封端面。",
        "这是使用 Azure AI 生成并经过整理的静态示例。",
      ],
    },
  };
}

export function localizeDemoFigure<T extends {
  id: string;
  title: string;
  subject?: string;
  summary?: string;
}>(figure: T, locale: Locale): T {
  if (locale === "en" || figure.id !== demoResult.id) return figure;
  const localized = localizedDemoResult(locale);
  return {
    ...figure,
    title: localized.annotation.title,
    ...(figure.subject === undefined ? {} : { subject: demoSubject[locale] }),
    ...(figure.summary === undefined ? {} : { summary: localized.annotation.summary }),
  };
}
