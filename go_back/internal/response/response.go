package response

import (
	"github.com/gin-gonic/gin"
)

// SuccessResponse 标准成功响应 (如非特殊要求，部分接口前端可能直接期望返回实体对象或数组)
func Success(c *gin.Context, data interface{}) {
	c.JSON(200, data)
}

// ErrorResponse 错误格式
type ErrorResponse struct {
	Message string `json:"message"`
}

func Error(c *gin.Context, status int, message string) {
	c.JSON(status, ErrorResponse{Message: message})
}

// PageResponse 分页数据格式（兼容 Spring Data Page）
type PageResponse struct {
	Content       interface{} `json:"content"`
	TotalElements int64       `json:"totalElements"`
	TotalPages    int         `json:"totalPages"`
	Size          int         `json:"size"`
	Number        int         `json:"number"`
	First         bool        `json:"first"`
	Last          bool        `json:"last"`
	Empty         bool        `json:"empty"`
}

func Page(c *gin.Context, content interface{}, totalElements int64, size, number int) {
	if size <= 0 {
		size = 10
	}
	
	totalPages := int((totalElements + int64(size) - 1) / int64(size))
	
	first := number == 0
	last := number >= totalPages-1
	if totalPages == 0 {
		last = true
	}
	empty := totalElements == 0

	c.JSON(200, PageResponse{
		Content:       content,
		TotalElements: totalElements,
		TotalPages:    totalPages,
		Size:          size,
		Number:        number,
		First:         first,
		Last:          last,
		Empty:         empty,
	})
}
