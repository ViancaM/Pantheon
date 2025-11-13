from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('game/', views.game_view, name='game'),
    path('settings/', views.settings_view, name='settings'),
    path('help/', views.help_view, name='help'),
    path('about/', views.about_view, name='about'),
]