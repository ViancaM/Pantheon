from django.shortcuts import render

def home(request):
    return render(request, 'game/home.html')

def game_view(request):
    return render(request, 'game/game.html')

def settings_view(request):
    return render(request, 'game/settings.html')

def help_view(request):
    return render(request, 'game/help.html')

def about_view(request):
    return render(request, 'game/about.html')
