package app

import (
	"context"
	"fmt"
	"image"
	"image/color"

	"gioui.org/layout"
	"gioui.org/op"
	"gioui.org/op/clip"
	"gioui.org/op/paint"
	"gioui.org/text"
	"gioui.org/widget/material"
	"github.com/rprtr258/apiary/internal/database"
	"github.com/rs/zerolog/log"
)

type App struct {
	ctx context.Context
	DB  *database.DB
}

func New(filename string) (*App, func()) {
	db, err := database.New(filename)
	if err != nil {
		log.Panic().Err(err).Msg("failed to create database")
	}

	s := &App{DB: db}
	return s,
		func() { db.Close() }
}

var (
	theme           = material.NewTheme()
	backgroundColor = color.NRGBA{R: 27, G: 38, B: 54, A: 255}
	maroon          = color.NRGBA{R: 127, G: 0, B: 0, A: 255}
	red             = color.NRGBA{R: 255, G: 0, B: 0, A: 255}
	blue            = color.NRGBA{R: 0, G: 0, B: 255, A: 255}
)

func Split(gtx layout.Context, left, right layout.Widget) layout.Dimensions {
	leftsize := gtx.Constraints.Min.X / 2
	rightsize := gtx.Constraints.Min.X - leftsize

	gtx.Constraints = layout.Exact(image.Pt(leftsize, gtx.Constraints.Max.Y))
	left(gtx)

	gtx.Constraints = layout.Exact(image.Pt(rightsize, gtx.Constraints.Max.Y))
	trans := op.Offset(image.Pt(leftsize, 0)).Push(gtx.Ops)
	right(gtx)
	trans.Pop()

	return layout.Dimensions{Size: gtx.Constraints.Max}
}

func exampleSplitVisual(gtx layout.Context, th *material.Theme) layout.Dimensions {
	return Split(gtx,
		func(gtx layout.Context) layout.Dimensions {
			return FillWithLabel(gtx, th, "Left", red)
		},
		func(gtx layout.Context) layout.Dimensions {
			return FillWithLabel(gtx, th, "Right", blue)
		})
}

func FillWithLabel(gtx layout.Context, th *material.Theme, text string, backgroundColor color.NRGBA) layout.Dimensions {
	// ColorBox(gtx, gtx.Constraints.Max, backgroundColor)
	fmt.Println(gtx.Constraints, text)
	defer clip.UniformRRect(image.Rectangle{
		Max: gtx.Constraints.Max,
	}, 0).Push(gtx.Ops).Pop()
	paint.Fill(gtx.Ops, backgroundColor)
	return layout.Center.Layout(gtx, material.H3(th, text).Layout)
}

func (a *App) Layout(gtx layout.Context) layout.Dimensions {
	defer clip.UniformRRect(image.Rectangle{
		Max: gtx.Constraints.Max,
	}, 0).Push(gtx.Ops).Pop()
	paint.Fill(gtx.Ops, backgroundColor)

	// exampleSplitVisual(gtx, theme)
	// Define an large label with an appropriate text:
	title := material.H1(theme, "Hello, Gio")
	title.Color = maroon          // Change the color of the label.
	title.Alignment = text.Middle // Change the position of the label.
	title.Layout(gtx)             // Draw the label to the graphics context.

	return layout.Dimensions{Size: gtx.Constraints.Max}
}
