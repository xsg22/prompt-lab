// 高度控制工具 - 统一管理页面布局高度
export class HeightController {
  // 页面基础间距配置
  private static readonly CONFIG = {
    containerPadding: 8,        // 外层容器padding
    cardMargin: 8,              // Card之间的间距
    toolbarHeight: 75,          // 顶部工具栏高度（压缩后）
    cardHeaderHeight: 57,       // Card标题栏高度
    cardBodyPadding: 8,         // Card内容区padding
    scrollbarReserve: 2,        // 滚动条预留空间
  };

  // 响应式配置 - 根据屏幕高度动态调整
  private static readonly RESPONSIVE_BREAKPOINTS = {
    small: 768,    // 小屏幕：< 768px
    medium: 1080,  // 中屏幕：768px - 1080px  
    large: 1440,   // 大屏幕：1080px - 1440px
    xlarge: Infinity // 超大屏幕：> 1440px
  };

  /**
   * 获取当前屏幕尺寸类型
   * @returns 屏幕尺寸类型
   */
  private static getScreenSizeType(): 'small' | 'medium' | 'large' | 'xlarge' {
    const screenHeight = window.innerHeight;
    
    if (screenHeight < this.RESPONSIVE_BREAKPOINTS.small) {
      return 'small';
    } else if (screenHeight < this.RESPONSIVE_BREAKPOINTS.medium) {
      return 'medium';
    } else if (screenHeight < this.RESPONSIVE_BREAKPOINTS.large) {
      return 'large';
    } else {
      return 'xlarge';
    }
  }

  /**
   * 计算主内容区域的高度
   * @param hasToolbar 是否有顶部工具栏
   * @returns CSS高度值
   */
  static getMainContentHeight(hasToolbar: boolean = true): string {
    const {
      containerPadding,
      cardMargin,
      toolbarHeight,
      scrollbarReserve
    } = this.CONFIG;

    const totalReserved = 
      containerPadding * 2 +    // 上下padding
      (hasToolbar ? toolbarHeight + cardMargin : 0) + // 工具栏和间距
      scrollbarReserve;         // 滚动条预留

    return `calc(100vh - ${totalReserved}px)`;
  }

  /**
   * 计算Card内容区域的高度
   * @param hasToolbar 是否有顶部工具栏
   * @returns CSS高度值
   */
  static getCardContentHeight(hasToolbar: boolean = true): string {
    const {
      containerPadding,
      cardMargin,
      toolbarHeight,
      cardHeaderHeight,
      scrollbarReserve
    } = this.CONFIG;

    const totalReserved = 20 +
      containerPadding * 2 +    // 外层容器padding
      (hasToolbar ? toolbarHeight + cardMargin : 0) + // 工具栏
      cardHeaderHeight +        // Card标题栏
      scrollbarReserve;         // 滚动条预留

    return `calc(100vh - ${totalReserved}px)`;
  }

  /**
   * 计算Card Body的高度
   * @param hasToolbar 是否有顶部工具栏
   * @returns CSS高度值
   */
  static getCardBodyHeight(hasToolbar: boolean = true): string {
    const {
      containerPadding,
      cardMargin,
      toolbarHeight,
      cardHeaderHeight,
      cardBodyPadding,
      scrollbarReserve
    } = this.CONFIG;

    const totalReserved = 20 +
      containerPadding * 2 +    // 外层容器padding
      (hasToolbar ? toolbarHeight + cardMargin : 0) + // 工具栏
      cardHeaderHeight +        // Card标题栏
      cardBodyPadding * 2 +     // Card内容padding
      scrollbarReserve;         // 滚动条预留

    return `calc(100vh - ${totalReserved}px)`;
  }

  /**
   * 获取容器样式配置
   */
  static getContainerStyle() {
    return {
      padding: `${this.CONFIG.containerPadding}px`,
      background: '#f5f5f5',
    //   minHeight: '100vh',
      overflow: 'hidden', // 防止外层滚动
      height: this.getCardContentHeight(false)
    };
  }

  /**
   * 获取工具栏样式配置
   */
  static getToolbarStyle() {
    return {
      marginBottom: `${this.CONFIG.cardMargin}px`,
      height: `${this.CONFIG.toolbarHeight}px`
    };
  }

  /**
   * 获取Card样式配置
   * @param hasToolbar 是否有顶部工具栏
   */
  static getCardStyle(hasToolbar: boolean = true) {
    return {
      height: this.getCardContentHeight(hasToolbar)
    };
  }

  /**
   * 获取Card Body样式配置
   * @param hasToolbar 是否有顶部工具栏
   */
  static getCardBodyStyle(hasToolbar: boolean = true) {
    return {
      height: this.getCardBodyHeight(hasToolbar),
      overflow: 'auto',
      padding: `${this.CONFIG.cardBodyPadding}px`
    };
  }


  /**
   * 获取基于屏幕尺寸的消息输入框基础配置
   * @param role 消息角色
   * @returns 基础配置对象
   */
  static getResponsiveBaseConfig(role: string) {
    const screenType = this.getScreenSizeType();
    const screenHeight = window.innerHeight;
    
    // 定义不同屏幕尺寸的基础配置
    const baseConfigs = {
      small: {
        system: { minRows: 3, maxRows: 12 },
        user: { minRows: 3, maxRows: 8 },
        assistant: { minRows: 3, maxRows: 12 }
      },
      medium: {
        system: { minRows: 3, maxRows: 15 },
        user: { minRows: 3, maxRows: 12 },
        assistant: { minRows: 3, maxRows: 15 }
      },
      large: {
        system: { minRows: 4, maxRows: 20 },
        user: { minRows: 4, maxRows: 18 },
        assistant: { minRows: 4, maxRows: 20 }
      },
      xlarge: {
        system: { minRows: 4, maxRows: 20 },
        user: { minRows: 4, maxRows: 18 },
        assistant: { minRows: 4, maxRows: 20 }
      }
    };

    // 获取对应角色和屏幕尺寸的配置
    const roleConfig = baseConfigs[screenType][role as keyof typeof baseConfigs[typeof screenType]] || 
                      baseConfigs[screenType].user;

    // 基于实际屏幕高度进行微调
    const heightRatio = Math.min(Math.max(screenHeight / 1080, 0.6), 2.0);
    
    return {
      minRows: Math.max(1, Math.round(roleConfig.minRows * heightRatio)),
      maxRows: Math.max(roleConfig.minRows + 1, Math.round(roleConfig.maxRows * heightRatio))
    };
  }
}

// 导出常用的高度计算函数
export const {
  getMainContentHeight,
  getCardContentHeight,
  getCardBodyHeight,
  getContainerStyle,
  getToolbarStyle,
  getCardStyle,
  getCardBodyStyle
} = HeightController; 