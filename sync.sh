#!/bin/bash

# PayIn项目rclone同步脚本
# 用法: ./sync.sh [push|pull]

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
    echo -e "${BLUE}PayIn项目rclone同步脚本${NC}"
    echo
    echo "用法: ./sync.sh [push|pull|help] [--dry-run]"
    echo
    echo "命令:"
    echo "  push       推送本地更改到OneDrive"
    echo "  pull       从OneDrive拉取更新到本地"
    echo "  help       显示此帮助信息"
    echo
    echo "选项:"
    echo "  --dry-run  预览操作而不实际执行"
    echo
    echo "示例:"
    echo "  ./sync.sh push         # 直接推送本地项目到OneDrive"
    echo "  ./sync.sh pull         # 直接从OneDrive同步到本地"  
    echo "  ./sync.sh push --dry-run   # 预览推送操作"
    echo "  ./sync.sh pull --dry-run   # 预览拉取操作"
}

# 检查rclone是否安装
check_rclone() {
    if ! which rclone >/dev/null 2>&1; then
        echo -e "${RED}错误: rclone未安装${NC}"
        echo "请先安装rclone: https://rclone.org/install/"
        exit 1
    fi
}

# 检查.rcloneignore文件是否存在
check_ignore_file() {
    if [ ! -f ".rcloneignore" ]; then
        echo -e "${YELLOW}警告: .rcloneignore文件不存在${NC}"
        echo "将同步所有文件（包括node_modules等）"
        printf "是否继续? (y/N): "
        read REPLY
        echo
        if [ "$REPLY" != "y" ] && [ "$REPLY" != "Y" ]; then
            echo "已取消操作"
            exit 1
        fi
    fi
}

# 推送到OneDrive
push_to_onedrive() {
    local dry_run_flag="$1"
    
    if [ "$dry_run_flag" = "--dry-run" ]; then
        echo -e "${YELLOW}🔍 预览推送到OneDrive (干运行模式)...${NC}"
        echo "目标: onedrive:dev/payin"
        echo
        echo -e "${BLUE}将要同步的文件:${NC}"
        rclone sync . onedrive:dev/payin \
            --transfers 8 \
            --checkers 8 \
            --fast-list \
            --exclude-from .rcloneignore \
            --dry-run \
            --verbose
    else
        echo -e "${GREEN}🚀 推送本地项目到OneDrive...${NC}"
        echo "目标: onedrive:dev/payin"
        echo
        echo -e "${GREEN}开始同步...${NC}"
        rclone sync . onedrive:dev/payin \
            --transfers 8 \
            --checkers 8 \
            --fast-list \
            --exclude-from .rcloneignore \
            --progress
        echo -e "${GREEN}✅ 推送完成!${NC}"
    fi
}

# 从OneDrive拉取
pull_from_onedrive() {
    local dry_run_flag="$1"
    
    if [ "$dry_run_flag" = "--dry-run" ]; then
        echo -e "${YELLOW}🔍 预览从OneDrive拉取 (干运行模式)...${NC}"
        echo "源: onedrive:dev/payin"
        echo
        echo -e "${BLUE}将要同步的文件:${NC}"
        rclone sync onedrive:dev/payin . \
            --transfers 8 \
            --checkers 8 \
            --fast-list \
            --exclude-from .rcloneignore \
            --dry-run \
            --verbose
    else
        echo -e "${GREEN}📥 从OneDrive拉取项目更新...${NC}"
        echo "源: onedrive:dev/payin"
        echo
        echo -e "${GREEN}开始同步...${NC}"
        rclone sync onedrive:dev/payin . \
            --transfers 8 \
            --checkers 8 \
            --fast-list \
            --exclude-from .rcloneignore \
            --progress
        echo -e "${GREEN}✅ 拉取完成!${NC}"
    fi
}

# 主函数
main() {
    # 检查依赖
    check_rclone
    check_ignore_file
    
    case "${1:-}" in
        "push")
            push_to_onedrive "${2:-}"
            ;;
        "pull") 
            pull_from_onedrive "${2:-}"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        "")
            echo -e "${RED}错误: 请指定操作 (push 或 pull)${NC}"
            echo
            show_help
            exit 1
            ;;
        *)
            echo -e "${RED}错误: 未知参数 '$1'${NC}"
            echo
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"