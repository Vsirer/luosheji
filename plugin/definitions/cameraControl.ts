import { AiSkill } from "../../skills/types.ts";

export const cameraControlSkill: AiSkill = {
  id: "camera-control",
  name: "相机调整",
  desc: "配置专业级拍摄与摄影相机参数",
  icon: "📷",
  instruction: "根据指定的相机机型、镜头、焦段、光圈、色调、灯光等专业拍摄参数，生成具有极致电影质感和高水准专业摄影美学的画面。",
  isSystem: true,
  isInstalled: true,
  isPublic: true,
  customOptions: [
    {
      id: "cameraModel",
      name: "相机/机型",
      choices: [
        "全画幅电影级数码相机",
        "大画幅 70 毫米胶片相机",
        "S35 画幅数码影棚相机",
        "经典 16 毫米胶片相机",
        "高端大画幅数码相机",
        "Sony Venice",
        "Arri Alexa 35",
        "ARRI Alexa65",
        "Red V-Raptor",
        "Panavision DXL2",
        "Arricam LT",
        "Arriflex 435",
        "IMAX Keighley",
        "IMAX"
      ]
    },
    {
      id: "lensType",
      name: "镜头类型",
      choices: [
        "无特定镜头",
        "创意移轴镜头（球面类型）",
        "紧凑型变形宽银幕镜头（变形宽银幕类型）",
        "超微距镜头（球面类型）",
        "70 年代风格电影定焦镜头（球面类型）",
        "经典变形宽银幕镜头（变形宽银幕类型）",
        "高端现代定焦镜头（球面类型）",
        "暖调电影定焦镜头（球面类型）",
        "旋焦散景人像镜头（球面类型）",
        "复古定焦镜头（球面类型）",
        "光晕弥散镜头镜头（变形宽银幕）"
      ]
    },
    {
      id: "focalLength",
      name: "焦段",
      choices: ["自动", "8 毫米", "14 毫米", "35 毫米", "50 毫米", "85 毫米", "135 毫米"]
    },
    {
      id: "aperture",
      name: "光圈",
      choices: ["自动", "f/1.4", "f/1.8", "f/2.8", "f/4.0", "f/5.6", "f/8.0", "f/11", "f/16"]
    },
    {
      id: "colorTone",
      name: "色调",
      choices: [
        "默认", "温暖的", "凉爽的", "混合", "饱和", "去饱和", "红色的", "橙子", "黄色的", "绿色的", "青色", "蓝色的", "紫色", "品红", "粉色的", "白色的", "棕褐色", "黑白"
      ]
    },
    {
      id: "lighting",
      name: "灯光",
      choices: ["默认", "柔光", "硬光", "高对比度", "低对比度", "轮廓", "顶灯", "底光", "侧灯", "背光", "边缘光"]
    },
    {
      id: "lightingType",
      name: "照明类型",
      choices: ["默认", "日光", "阳光明媚", "灰蒙蒙", "月光", "人造光", "实用照明", "荧光", "火光", "混合光"]
    }
  ]
};
